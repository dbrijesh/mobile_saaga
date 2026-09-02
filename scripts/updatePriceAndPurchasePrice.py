import boto3
import openpyxl
import sys
from decimal import Decimal

DRY_RUN = '--apply' not in sys.argv

# 1 INR in SGD, mid-market rate as of 2026-08-11 (source: Pluang)
INR_TO_SGD_RATE = 0.013387

EXCEL_PATH = r'E:\mobilesaaga\SAAGA_MASTER_12Aug2026.xlsx'

# Read Excel: A=SKU, E=Price (SGD), N=Online Price INR (purchase price, INR)
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active
excel_rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    sku = row[0]
    price = row[4]
    purchase_price_inr = row[13]
    if not sku:
        continue
    try:
        purchase_price_inr_val = round(float(purchase_price_inr), 2) if purchase_price_inr is not None else None
    except (ValueError, TypeError):
        purchase_price_inr_val = None
    try:
        price_val = round(float(price), 2) if price is not None else None
    except (ValueError, TypeError):
        price_val = None
    # A price of exactly 0 is a formula artifact (price is derived from the
    # blank purchase-price column), not a real price - treat as missing.
    if price_val == 0:
        price_val = None
    excel_rows.append({
        'sku': str(sku).strip(),
        'price': price_val,
        'purchasePriceINR': purchase_price_inr_val,
    })

print(f"Read {len(excel_rows)} rows from Excel")

# Read DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table = dynamodb.Table('saaga-online-api-products-dev')
db_items = []
resp = table.scan(
    ProjectionExpression='id, sku, price, discountPercent, purchasePriceINR, purchasePriceSGD'
)
db_items.extend(resp['Items'])
while 'LastEvaluatedKey' in resp:
    resp = table.scan(
        ProjectionExpression='id, sku, price, discountPercent, purchasePriceINR, purchasePriceSGD',
        ExclusiveStartKey=resp['LastEvaluatedKey']
    )
    db_items.extend(resp['Items'])

lookup = {item['sku']: item for item in db_items if item.get('sku')}

updates = []
no_match = []
skipped = []
no_purchase_price = []
for row in excel_rows:
    db = lookup.get(row['sku'])
    if not db:
        no_match.append(row)
        continue
    if row['price'] is None:
        skipped.append(row)
        continue
    old_price = float(db['price'])
    if abs(row['price'] - old_price) < 0.001:
        skipped.append(row)
        continue
    if row['purchasePriceINR'] is None:
        no_purchase_price.append(row)

    purchase_price_sgd = round(row['purchasePriceINR'] * INR_TO_SGD_RATE, 2) if row['purchasePriceINR'] is not None else None
    old_purchase_inr = float(db['purchasePriceINR']) if db.get('purchasePriceINR') is not None else None
    old_purchase_sgd = float(db['purchasePriceSGD']) if db.get('purchasePriceSGD') is not None else None

    discount_percent = float(db.get('discountPercent') or 0)
    new_discounted_price = round(row['price'] * (1 - discount_percent / 100), 2)

    updates.append({
        'id': db['id'],
        'sku': row['sku'],
        'old_price': old_price,
        'new_price': row['price'],
        'new_discounted_price': new_discounted_price,
        'old_purchase_inr': old_purchase_inr,
        'new_purchase_inr': row['purchasePriceINR'],
        'old_purchase_sgd': old_purchase_sgd,
        'new_purchase_sgd': purchase_price_sgd,
    })

print(f"MATCHED: {len(updates)}, NO MATCH: {len(no_match)}, SKIPPED (missing data): {len(skipped)}")
print(f"Using INR->SGD rate: {INR_TO_SGD_RATE}")

price_changed = [u for u in updates if abs(u['old_price'] - u['new_price']) > 0.001]
print(f"\nProducts with a price change: {len(price_changed)}")
for u in price_changed[:15]:
    print(f"  {u['sku']}  price ${u['old_price']} -> ${u['new_price']}")
if len(price_changed) > 15:
    print(f"  ... and {len(price_changed) - 15} more")

print(f"\nSample purchase price additions:")
for u in updates[:5]:
    print(f"  {u['sku']}  purchase INR {u['old_purchase_inr']} -> {u['new_purchase_inr']}, purchase SGD {u['old_purchase_sgd']} -> {u['new_purchase_sgd']}")

if no_match:
    print(f"\n--- NO MATCH (SKUs in Excel not found in DynamoDB, skipped) ---")
    for r in no_match[:20]:
        print(f"  {r['sku']}")
    if len(no_match) > 20:
        print(f"  ... and {len(no_match) - 20} more")

if skipped:
    print(f"\n--- SKIPPED (missing price in Excel row) ---")
    for r in skipped[:20]:
        print(f"  {r['sku']}")

if no_purchase_price:
    print(f"\n--- NO PURCHASE PRICE (price will still be updated, purchase price left as-is) ---")
    for r in no_purchase_price:
        print(f"  {r['sku']}")

if DRY_RUN:
    print()
    print("DRY RUN — no changes made. Run with --apply to update DynamoDB.")
else:
    print()
    print(f"Applying {len(updates)} updates to DynamoDB...")
    import datetime
    done = 0
    for u in updates:
        set_parts = ['price = :p', 'discountedPrice = :dp', 'updatedAt = :ua']
        values = {
            ':p': Decimal(str(u['new_price'])),
            ':dp': Decimal(str(u['new_discounted_price'])),
            ':ua': datetime.datetime.utcnow().isoformat() + 'Z',
        }
        if u['new_purchase_inr'] is not None:
            set_parts.append('purchasePriceINR = :pinr')
            set_parts.append('purchasePriceSGD = :psgd')
            values[':pinr'] = Decimal(str(u['new_purchase_inr']))
            values[':psgd'] = Decimal(str(u['new_purchase_sgd']))

        table.update_item(
            Key={'id': u['id']},
            UpdateExpression='SET ' + ', '.join(set_parts),
            ExpressionAttributeValues=values,
        )
        done += 1
        if done % 100 == 0:
            print(f"  {done}/{len(updates)} updated...")
    print(f"Done. {done} products updated.")
