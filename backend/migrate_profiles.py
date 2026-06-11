from supabase import create_client
import os
from dotenv import load_dotenv
load_dotenv()

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

# Sync email + name into profiles for all existing users
users = sb.auth.admin.list_users()
print(f"Found {len(users)} users")

for u in users:
    email = u.email or ''
    name = (u.user_metadata or {}).get('name', '') or email.split('@')[0]
    try:
        sb.table('profiles').upsert({
            'id': str(u.id),
            'email': email,
            'name': name,
            'role': (u.user_metadata or {}).get('role', 'user'),
        }, on_conflict='id').execute()
        print(f"Synced: {email}")
    except Exception as e:
        print(f"Error syncing {email}: {e}")

print("Migration complete")
