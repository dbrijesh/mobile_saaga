import boto3
import openpyxl
import sys
import datetime
from decimal import Decimal

DRY_RUN = '--apply' not in sys.argv

EXCEL_PATH = r'E:\mobilesaaga\SAAGA_MASTER_12Aug2026.xlsx'
SKU_LIST_PATH = r'E:\mobilesaaga\scripts\changed_skus.txt'

with open(SKU_LIST_PATH) as f:
    target_skus = set(line.strip() for line in f if line.strip())

print(f"Restricting update to {len(target_skus)} SKUs (the products updated in the last price/purchase-price run)")

# Read Excel: A=SKU, J=Unit, K=Weight
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active
excel_rows = {}
for row in ws.iter_rows(min_row=2, values_only=True):
    sku = row[0]
    unit = row[9]
    weight = row[10]
    if not sku:
        continue
    sku = str(sku).strip()
    if sku not in target_skus:
        continue
    excel_rows[sku] = {
        'unit': str(unit).strip() if unit is not None else None,
        'weight': weight,
    }

print(f"Found {len(excel_rows)} of the target SKUs in Excel")

dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table = dynamodb.Table('saaga-online-api-products-dev')

# Fetch DB items by scanning once (small dataset) and matching by sku
db_items = []
resp = table.scan(ProjectionExpression='id, sku, #u, weight', ExpressionAttributeNames={'#u': 'unit'})
db_items.extend(resp['Items'])
while 'LastEvaluatedKey' in resp:
    resp = table.scan(ProjectionExpression='id, sku, #u, weight', ExpressionAttributeNames={'#u': 'unit'}, ExclusiveStartKey=resp['LastEvaluatedKey'])
    db_items.extend(resp['Items'])
lookup = {item['sku']: item for item in db_items if item.get('sku')}

updates = []
no_match = []
skipped = []
for sku in sorted(target_skus):
    excel = excel_rows.get(sku)
    if not excel or excel['unit'] is None or excel['weight'] is None:
        skipped.append(sku)
        continue
    db = lookup.get(sku)
    if not db:
        no_match.append(sku)
        continue
    old_unit = db.get('unit')
    old_weight = db.get('weight')
    try:
        new_weight = float(excel['weight'])
    except (ValueError, TypeError):
        skipped.append(sku)
        continue
    try:
        old_weight_f = float(old_weight) if old_weight not in (None, '') else None
    except (ValueError, TypeError):
        old_weight_f = None
    if old_unit == excel['unit'] and old_weight_f is not None and abs(old_weight_f - new_weight) < 0.001:
        continue  # no change
    updates.append({
        'id': db['id'],
        'sku': sku,
        'old_unit': old_unit,
        'new_unit': excel['unit'],
        'old_weight': old_weight_f,
        'new_weight': new_weight,
    })

print(f"\nUpdates needed: {len(updates)}")
for u in updates[:20]:
    print(f"  {u['sku']}  unit {u['old_unit']} -> {u['new_unit']}, weight {u['old_weight']} -> {u['new_weight']}")
if len(updates) > 20:
    print(f"  ... and {len(updates) - 20} more")

if no_match:
    print(f"\nNO MATCH in DynamoDB: {no_match}")
if skipped:
    print(f"\nSKIPPED (missing unit/weight in Excel): {skipped}")

if DRY_RUN:
    print("\nDRY RUN — no changes made. Run with --apply to update DynamoDB.")
else:
    print(f"\nApplying {len(updates)} updates to DynamoDB...")
    done = 0
    for u in updates:
        table.update_item(
            Key={'id': u['id']},
            UpdateExpression='SET #u = :unit, weight = :weight, updatedAt = :ua',
            ExpressionAttributeNames={'#u': 'unit'},
            ExpressionAttributeValues={
                ':unit': u['new_unit'],
                ':weight': Decimal(str(u['new_weight'])),
                ':ua': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
            },
        )
        done += 1
    print(f"Done. {done} products updated.")
