# Backend Django Project

## Setup Local

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file
cp .env.local .env.local   # Already populated with local DB credentials

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server (uses config.settings.local by default)
python manage.py runserver 8000
```

## Settings Structure

- `config/settings/base.py` - Common settings
- `config/settings/local.py` - Development (uses `.env.local`)
- `config/settings/production.py` - Production (uses `.env`)

## Running with Different Settings

```bash
# Local (default for manage.py)
python manage.py runserver

# Production
DJANGO_SETTINGS_MODULE=config.settings.production python manage.py runserver

# Or export first
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py runserver
```

## Production Deployment

1. Copy `.env.production.example` to `.env`
2. Fill in production values (SECRET_KEY, DATABASE_URL, ALLOWED_HOSTS, etc.)
3. Run with Gunicorn:
   ```bash
   DJANGO_SETTINGS_MODULE=config.settings.production gunicorn config.wsgi:application --bind 0.0.0.0:8000
   ```

## API Endpoints

- `POST /api/auth/login/` - JWT login (email/password)
- `POST /api/auth/refresh/` - Refresh JWT token
- `GET/POST /api/users/` - User list/create
- `GET/PUT/PATCH/DELETE /api/users/{id}/` - User detail

## Admin

Access Django admin at `http://127.0.0.1:8000/admin/` after creating a superuser.
