import os

base = '/Users/benjaminvandamme/Developer/house/apps'
to_delete = [
    'app_settings/templates/app_settings/app/settings.html',
    'directory/templates/contacts/app/contact-detail.html',
    'directory/templates/contacts/app/contact-edit.html',
    'directory/templates/contacts/app/contact-new.html',
    'directory/templates/contacts/app/contacts.html',
    'directory/templates/contacts/app/structure-detail.html',
    'directory/templates/contacts/app/structure-edit.html',
    'directory/templates/contacts/app/structure-new.html',
    'documents/templates/documents/app/documents.html',
    'equipment/templates/equipment/app/equipment_detail.html',
    'equipment/templates/equipment/app/equipment_edit.html',
    'equipment/templates/equipment/app/equipment_new.html',
    'equipment/templates/equipment/app/equipment.html',
    'interactions/templates/interactions/app/interaction_new.html',
    'interactions/templates/interactions/app/interactions.html',
    'photos/templates/photos/app/photos.html',
    'projects/templates/projects/app/project_detail.html',
    'projects/templates/projects/app/project_edit.html',
    'projects/templates/projects/app/project_group_detail.html',
    'projects/templates/projects/app/project_groups.html',
    'projects/templates/projects/app/project_new.html',
    'projects/templates/projects/app/projects.html',
    'stock/templates/stock/app/stock_detail.html',
    'stock/templates/stock/app/stock_edit.html',
    'stock/templates/stock/app/stock_new.html',
    'stock/templates/stock/app/stock.html',
    'tasks/templates/tasks/app/tasks.html',
    'zones/templates/zones/app/zones.html',
]

for rel in to_delete:
    p = os.path.join(base, rel)
    if os.path.exists(p):
        os.remove(p)
        print('deleted:', rel)
    else:
        print('not found:', rel)

print('done')
