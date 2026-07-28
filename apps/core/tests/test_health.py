"""Tests de la sonde `/health/` — le point d'appui du deploy sans 502 (issue #449).

Le healthcheck Docker et le `up -d --wait` du deploy s'accrochent à cette URL :
elle décide du moment où le conteneur neuf est déclaré prêt, donc du moment où le
deploy se poursuit. D'où deux exigences qui ne sont pas cosmétiques :

- **anonyme** : la sonde n'a ni session ni token ;
- **pas la SPA** : le catch-all React répond 200 + du HTML pour n'importe quelle
  URL. Un `/health/` avalé par le catch-all dirait « prêt » sans que Django ait
  eu à servir une seule vue — le deploy basculerait sur un conteneur cassé sans
  jamais le voir.

La sonde reste volontairement **une preuve de vie, pas de santé** : elle ne touche
pas la base. Un hoquet de postgres marquerait sinon `web` malade, et le prochain
`up -d --wait` attendrait un conteneur qui, lui, va très bien.
"""
import pytest
from django.test import Client


@pytest.fixture
def response():
    return Client().get('/health/')


@pytest.mark.django_db
def test_health_answers_200_json_to_an_anonymous_caller(response):
    assert response.status_code == 200
    assert response['Content-Type'].startswith('application/json')
    assert response.json() == {'status': 'ok'}


@pytest.mark.django_db
def test_health_is_never_cached(response):
    """Un healthcheck servi depuis un cache ne mesure plus rien."""
    assert 'no-store' in response['Cache-Control']


@pytest.mark.django_db
def test_health_is_not_the_react_catchall(response):
    """La régression à empêcher : `/health/` avalé par le catch-all SPA."""
    assert b'<html' not in response.content.lower()


@pytest.mark.django_db
def test_health_does_not_touch_the_database(django_assert_num_queries, client):
    """Zéro requête : la sonde tourne toutes les 10 s, à côté du trafic réel."""
    with django_assert_num_queries(0):
        client.get('/health/')
