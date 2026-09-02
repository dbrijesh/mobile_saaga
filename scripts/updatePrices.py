import boto3
import openpyxl
import sys
from decimal import Decimal

DRY_RUN = '--apply' not in sys.argv

# Read Excel
wb = openpyxl.load_workbook(r'E:\mobilesaaga\Saaga Online-4.xlsx', data_only=True)
ws = wb.active
excel_rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    name = row[1]
    dummy = row[4]
    price_cached = row[5]
    unit = row[9]
    weight = row[10]
    if name and dummy:
        price = price_cached if price_cached is not None else round((float(dummy) * 1.5) / 75, 2)
        try:
            weight_str = str(int(float(str(weight)))) if weight is not None else ''
        except (ValueError, TypeError):
            weight_str = str(weight).strip() if weight is not None else ''
        excel_rows.append({
            'name': str(name).strip(),
            'unit': str(unit).strip() if unit else '',
            'weight': weight_str,
            'price': round(float(price), 2)
        })

# Read DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-southeast-1')
table = dynamodb.Table('saaga-online-api-products-dev')
db_items = []
resp = table.scan(
    ProjectionExpression='id, #n, #u, weight, price',
    ExpressionAttributeNames={'#n': 'name', '#u': 'unit'}
)
db_items.extend(resp['Items'])
while 'LastEvaluatedKey' in resp:
    resp = table.scan(
        ProjectionExpression='id, #n, #u, weight, price',
        ExpressionAttributeNames={'#n': 'name', '#u': 'unit'},
        ExclusiveStartKey=resp['LastEvaluatedKey']
    )
    db_items.extend(resp['Items'])

# Build lookup: (name_lower, unit_lower, weight_str) -> item
lookup = {}
for item in db_items:
    key = (
        item['name'].strip().lower(),
        str(item.get('unit', '')).strip().lower(),
        str(item.get('weight', '')).strip()
    )
    lookup[key] = item

matches = []
no_match = []
for row in excel_rows:
    key = (row['name'].lower(), row['unit'].lower(), row['weight'])
    if key in lookup:
        db = lookup[key]
        matches.append({
            'id': db['id'],
            'name': row['name'],
            'unit': row['unit'],
            'weight': row['weight'],
            'old_price': float(db['price']),
            'new_price': row['price']
        })
    else:
        no_match.append(row)

print(f"MATCHED: {len(matches)}, NO MATCH: {len(no_match)}")
print()
print("--- MATCHES ---")
for m in matches:
    print(f"  {m['name']} {m['weight']}{m['unit']}  ${m['old_price']} -> ${m['new_price']}")

if no_match:
    print()
    print("--- NO MATCH (skipped) ---")
    for r in no_match:
        print(f"  {r['name']} {r['weight']}{r['unit']}")

if DRY_RUN:
    print()
    print("DRY RUN — no changes made. Run with --apply to update DynamoDB.")
else:
    print()
    print(f"Applying {len(matches)} price updates to DynamoDB...")
    updated = 0
    for m in matches:
        table.update_item(
            Key={'id': m['id']},
            UpdateExpression='SET price = :p',
            ExpressionAttributeValues={':p': Decimal(str(m['new_price']))}
        )
        updated += 1
        if updated % 20 == 0:
            print(f"  {updated}/{len(matches)} updated...")
    print(f"Done. {updated} products updated.")
