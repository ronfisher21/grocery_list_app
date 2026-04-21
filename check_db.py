import os
from supabase import create_client

# Get credentials from .env
env_vars = {}
with open('.env') as f:
    for line in f:
        if '=' in line:
            k, v = line.strip().split('=', 1)
            env_vars[k] = v

project_url = env_vars.get('PROJECT_URL', '')
service_role_key = env_vars.get('SERVICE_ROLE_KEY', '')

if not project_url or not service_role_key:
    print("Missing Supabase credentials")
    exit(1)

client = create_client(project_url, service_role_key)

# Check grocery_items table
print("=== GROCERY ITEMS ===")
items_resp = client.table('grocery_items').select('*').execute()
items = items_resp.data if isinstance(items_resp.data, list) else []
for item in items:
    print(f"  {item.get('item_name'):20} | {item.get('category'):25} | checked={item.get('checked')}")

if not items:
    print("  (no items)")

# Check manual_overrides table
print("\n=== MANUAL OVERRIDES ===")
overrides_resp = client.table('manual_overrides').select('*').execute()
overrides = overrides_resp.data if isinstance(overrides_resp.data, list) else []
for override in overrides:
    print(f"  {override.get('item_name_normalized'):20} | {override.get('category'):25}")

if not overrides:
    print("  (no overrides)")

print(f"\nTotal items: {len(items)}")
print(f"Total overrides: {len(overrides)}")
