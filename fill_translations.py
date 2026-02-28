#!/usr/bin/env python3
"""
Script to fill in translations for FR/DE/ES .po files.
"""
import re

TRANSLATIONS = {
    "Display name shown in the UI": {
        "fr": "Nom affiché dans l'interface",
        "de": "In der UI angezeigter Name",
        "es": "Nombre mostrado en la interfaz",
    },
    "English": {"fr": "Anglais", "de": "Englisch", "es": "Inglés"},
    "Français": {"fr": "Français", "de": "Französisch", "es": "Francés"},
    "Deutsch": {"fr": "Allemand", "de": "Deutsch", "es": "Alemán"},
    "Español": {"fr": "Espagnol", "de": "Spanisch", "es": "Español"},
    "User's preferred language": {
        "fr": "Langue préférée de l'utilisateur",
        "de": "Bevorzugte Sprache des Benutzers",
        "es": "Idioma preferido del usuario",
    },
    "URL to user's avatar image": {
        "fr": "URL de l'image d'avatar de l'utilisateur",
        "de": "URL zum Avatar-Bild des Benutzers",
        "es": "URL de la imagen de avatar del usuario",
    },
    "user": {"fr": "utilisateur", "de": "Benutzer", "es": "usuario"},
    "users": {"fr": "utilisateurs", "de": "Benutzer", "es": "usuarios"},
    "Migration-ready section": {
        "fr": "Section prête à la migration",
        "de": "Migrationsfertige Sektion",
        "es": "Sección lista para migración",
    },
    "This screen is routed and rendered by Django, with a dedicated React mount node for progressive migration.": {
        "fr": "Cet écran est routé et rendu par Django, avec un nœud de montage React dédié pour la migration progressive.",
        "de": "Dieser Bildschirm wird von Django geroutet und gerendert, mit einem dedizierten React-Mount-Knoten für die progressive Migration.",
        "es": "Esta pantalla es enrutada y renderizada por Django, con un nodo de montaje React dedicado para la migración progresiva.",
    },
    "contact": {"fr": "contact", "de": "Kontakt", "es": "contacto"},
    "contacts": {"fr": "contacts", "de": "Kontakte", "es": "contactos"},
    "document": {"fr": "document", "de": "Dokument", "es": "documento"},
    "documents": {"fr": "documents", "de": "Dokumente", "es": "documentos"},
    "Single phase": {"fr": "Monophasé", "de": "Einphasig", "es": "Monofásico"},
    "Three phase": {"fr": "Triphasé", "de": "Dreiphasig", "es": "Trifásico"},
    "Socket": {"fr": "Prise", "de": "Steckdose", "es": "Enchufe"},
    "Light": {"fr": "Luminaire", "de": "Beleuchtung", "es": "Iluminación"},
    "electricity board": {"fr": "tableau électrique", "de": "Stromverteilerkasten", "es": "cuadro eléctrico"},
    "electricity boards": {"fr": "tableaux électriques", "de": "Stromverteilerkästen", "es": "cuadros eléctricos"},
    "RCD": {"fr": "DDR", "de": "FI-Schutzschalter", "es": "interruptor diferencial"},
    "RCDs": {"fr": "DDR", "de": "FI-Schutzschalter", "es": "interruptores diferenciales"},
    "breaker": {"fr": "disjoncteur", "de": "Leitungsschutzschalter", "es": "disyuntor"},
    "breakers": {"fr": "disjoncteurs", "de": "Leitungsschutzschalter", "es": "disyuntores"},
    "circuit": {"fr": "circuit", "de": "Stromkreis", "es": "circuito"},
    "circuits": {"fr": "circuits", "de": "Stromkreise", "es": "circuitos"},
    "usage point": {"fr": "point d'usage", "de": "Nutzungspunkt", "es": "punto de uso"},
    "usage points": {"fr": "points d'usage", "de": "Nutzungspunkte", "es": "puntos de uso"},
    "Household cannot be changed.": {
        "fr": "Le foyer ne peut pas être modifié.",
        "de": "Der Haushalt kann nicht geändert werden.",
        "es": "El hogar no puede ser cambiado.",
    },
    "Label must be unique across electricity entities in household.": {
        "fr": "L'étiquette doit être unique parmi les entités électriques du foyer.",
        "de": "Das Etikett muss unter den Elektroentitäten im Haushalt eindeutig sein.",
        "es": "La etiqueta debe ser única entre las entidades eléctricas del hogar.",
    },
    "Only one active board is allowed per household.": {
        "fr": "Un seul tableau actif est autorisé par foyer.",
        "de": "Pro Haushalt ist nur ein aktives Tableau erlaubt.",
        "es": "Solo se permite un cuadro activo por hogar.",
    },
    "Board must belong to the same household.": {
        "fr": "Le tableau doit appartenir au même foyer.",
        "de": "Das Tableau muss zum selben Haushalt gehören.",
        "es": "El cuadro debe pertenecer al mismo hogar.",
    },
    "RCD must belong to the same household.": {
        "fr": "Le DDR doit appartenir au même foyer.",
        "de": "Der FI-Schutzschalter muss zum selben Haushalt gehören.",
        "es": "El interruptor diferencial debe pertenecer al mismo hogar.",
    },
    "Breaker must belong to the same household.": {
        "fr": "Le disjoncteur doit appartenir au même foyer.",
        "de": "Der Leitungsschutzschalter muss zum selben Haushalt gehören.",
        "es": "El disyuntor debe pertenecer al mismo hogar.",
    },
    "Breaker must belong to the selected board.": {
        "fr": "Le disjoncteur doit appartenir au tableau sélectionné.",
        "de": "Der Leitungsschutzschalter muss zum ausgewählten Tableau gehören.",
        "es": "El disyuntor debe pertenecer al cuadro seleccionado.",
    },
    "Phase is required for three-phase board.": {
        "fr": "La phase est requise pour un tableau triphasé.",
        "de": "Die Phase ist für ein dreiphasiges Tableau erforderlich.",
        "es": "La fase es requerida para un cuadro trifásico.",
    },
    "Phase must be empty for single-phase board.": {
        "fr": "La phase doit être vide pour un tableau monophasé.",
        "de": "Die Phase muss für ein einphasiges Tableau leer sein.",
        "es": "La fase debe estar vacía para un cuadro monofásico.",
    },
    "Zone must belong to the same household.": {
        "fr": "La zone doit appartenir au même foyer.",
        "de": "Die Zone muss zum selben Haushalt gehören.",
        "es": "La zona debe pertenecer al mismo hogar.",
    },
    "Circuit must belong to the same household.": {
        "fr": "Le circuit doit appartenir au même foyer.",
        "de": "Der Stromkreis muss zum selben Haushalt gehören.",
        "es": "El circuito debe pertenecer al mismo hogar.",
    },
    "Usage point must belong to the same household.": {
        "fr": "Le point d'usage doit appartenir au même foyer.",
        "de": "Der Nutzungspunkt muss zum selben Haushalt gehören.",
        "es": "El punto de uso debe pertenecer al mismo hogar.",
    },
    "Usage point and circuit must be in the same household.": {
        "fr": "Le point d'usage et le circuit doivent appartenir au même foyer.",
        "de": "Nutzungspunkt und Stromkreis müssen im selben Haushalt sein.",
        "es": "El punto de uso y el circuito deben estar en el mismo hogar.",
    },
    "Usage point already has an active circuit link.": {
        "fr": "Le point d'usage a déjà un lien de circuit actif.",
        "de": "Der Nutzungspunkt hat bereits eine aktive Stromkreisverbindung.",
        "es": "El punto de uso ya tiene un enlace de circuito activo.",
    },
    "Actor is required.": {
        "fr": "L'acteur est requis.",
        "de": "Der Akteur ist erforderlich.",
        "es": "El actor es requerido.",
    },
    "Actor must be a member of the household.": {
        "fr": "L'acteur doit être membre du foyer.",
        "de": "Der Akteur muss Mitglied des Haushalts sein.",
        "es": "El actor debe ser miembro del hogar.",
    },
    "Electricity": {"fr": "Électricité", "de": "Elektrizität", "es": "Electricidad"},
    "Mini-app electricity initialized by Django SSR, then managed via API in-app.": {
        "fr": "Mini-app électricité initialisée par Django SSR, puis gérée via l'API en interne.",
        "de": "Elektrizitäts-Mini-App wird durch Django SSR initialisiert und dann intern über die API verwaltet.",
        "es": "Mini-app de electricidad inicializada por Django SSR, luego gestionada vía API en la aplicación.",
    },
    "Circuits": {"fr": "Circuits", "de": "Stromkreise", "es": "Circuitos"},
    "No circuits yet.": {"fr": "Aucun circuit pour l'instant.", "de": "Noch keine Stromkreise.", "es": "Todavía no hay circuitos."},
    "Breakers": {"fr": "Disjoncteurs", "de": "Leitungsschutzschalter", "es": "Disyuntores"},
    "No breakers yet.": {"fr": "Aucun disjoncteur pour l'instant.", "de": "Noch keine Leitungsschutzschalter.", "es": "Todavía no hay disyuntores."},
    "No RCDs yet.": {"fr": "Aucun DDR pour l'instant.", "de": "Noch keine FI-Schutzschalter.", "es": "Todavía no hay interruptores diferenciales."},
    "Usage points": {"fr": "Points d'usage", "de": "Nutzungspunkte", "es": "Puntos de uso"},
    "No usage points yet.": {"fr": "Aucun point d'usage pour l'instant.", "de": "Noch keine Nutzungspunkte.", "es": "Todavía no hay puntos de uso."},
    "Active links": {"fr": "Liens actifs", "de": "Aktive Verbindungen", "es": "Vínculos activos"},
    "No active links.": {"fr": "Aucun lien actif.", "de": "Keine aktiven Verbindungen.", "es": "No hay vínculos activos."},
    "Inactive links": {"fr": "Liens inactifs", "de": "Inaktive Verbindungen", "es": "Vínculos inactivos"},
    "No inactive links.": {"fr": "Aucun lien inactif.", "de": "Keine inaktiven Verbindungen.", "es": "No hay vínculos inactivos."},
    "Recent changes": {"fr": "Modifications récentes", "de": "Letzte Änderungen", "es": "Cambios recientes"},
    "No recent changes.": {"fr": "Aucune modification récente.", "de": "Keine letzten Änderungen.", "es": "No hay cambios recientes."},
    "No JavaScript fallback:": {
        "fr": "Solution de repli sans JavaScript :",
        "de": "Kein-JavaScript-Fallback:",
        "es": "Alternativa sin JavaScript:",
    },
    "equipment": {"fr": "équipement", "de": "Gerät", "es": "equipo"},
    "household": {"fr": "foyer", "de": "Haushalt", "es": "hogar"},
    "households": {"fr": "foyers", "de": "Haushalte", "es": "hogares"},
    "interaction": {"fr": "interaction", "de": "Interaktion", "es": "interacción"},
    "interactions": {"fr": "interactions", "de": "Interaktionen", "es": "interacciones"},
    "Create interaction": {"fr": "Créer une interaction", "de": "Interaktion erstellen", "es": "Crear interacción"},
    "Form connected to DRF endpoint with validation and feedback states.": {
        "fr": "Formulaire connecté à l'endpoint DRF avec validation et retours d'état.",
        "de": "Formular verbunden mit DRF-Endpunkt mit Validierung und Feedback-Zuständen.",
        "es": "Formulario conectado al endpoint DRF con validación y estados de retroalimentación.",
    },
    "Back to interactions": {"fr": "Retour aux interactions", "de": "Zurück zu Interaktionen", "es": "Volver a interacciones"},
    "Interactions": {"fr": "Interactions", "de": "Interaktionen", "es": "Interacciones"},
    "List powered by DRF with loading, empty and error states.": {
        "fr": "Liste alimentée par DRF avec états de chargement, vide et erreur.",
        "de": "Liste betrieben durch DRF mit Lade-, Leer- und Fehlerzuständen.",
        "es": "Lista impulsada por DRF con estados de carga, vacío y error.",
    },
    "You can still access data through the API endpoint": {
        "fr": "Vous pouvez toujours accéder aux données via l'endpoint de l'API",
        "de": "Sie können weiterhin über den API-Endpunkt auf Daten zugreifen",
        "es": "Aún puede acceder a los datos a través del endpoint de la API",
    },
    "zone": {"fr": "zone", "de": "Zone", "es": "zona"},
    "zones": {"fr": "zones", "de": "Zonen", "es": "zonas"},
    "Parent zone must belong to the same household": {
        "fr": "La zone parente doit appartenir au même foyer",
        "de": "Die übergeordnete Zone muss zum selben Haushalt gehören",
        "es": "La zona padre debe pertenecer al mismo hogar",
    },
    "Zones": {"fr": "Zones", "de": "Zonen", "es": "Zonas"},
    "Zones are rendered by Django with a dedicated React mini-app for progressive enhancements.": {
        "fr": "Les zones sont rendues par Django avec une mini-app React dédiée pour des améliorations progressives.",
        "de": "Zonen werden von Django mit einer dedizierten React-Mini-App für progressive Erweiterungen gerendert.",
        "es": "Las zonas son renderizadas por Django con una mini-app React dedicada para mejoras progresivas.",
    },
    "Server-side fallback": {"fr": "Repli côté serveur", "de": "Serverseitiger Fallback", "es": "Alternativa del lado del servidor"},
    "No zones yet.": {"fr": "Aucune zone pour l'instant.", "de": "Noch keine Zonen.", "es": "Todavía no hay zonas."},
    "Dashboard": {"fr": "Tableau de bord", "de": "Übersicht", "es": "Panel de control"},
    "Here's an overview of your house.": {
        "fr": "Voici un aperçu de votre maison.",
        "de": "Hier ist eine Übersicht Ihres Hauses.",
        "es": "Aquí hay un resumen de su casa.",
    },
    "Recent events": {"fr": "Événements récents", "de": "Letzte Ereignisse", "es": "Eventos recientes"},
    "Tasks": {"fr": "Tâches", "de": "Aufgaben", "es": "Tareas"},
    "Pending tasks": {"fr": "Tâches en attente", "de": "Ausstehende Aufgaben", "es": "Tareas pendientes"},
    "Documents": {"fr": "Documents", "de": "Dokumente", "es": "Documentos"},
    "Stored files": {"fr": "Fichiers stockés", "de": "Gespeicherte Dateien", "es": "Archivos almacenados"},
    "In progress": {"fr": "En cours", "de": "In Bearbeitung", "es": "En progreso"},
    "Open menu": {"fr": "Ouvrir le menu", "de": "Menü öffnen", "es": "Abrir menú"},
    "Close menu": {"fr": "Fermer le menu", "de": "Menü schließen", "es": "Cerrar menú"},
    "Projects": {"fr": "Projets", "de": "Projekte", "es": "Proyectos"},
    "Equipment": {"fr": "Équipements", "de": "Geräte", "es": "Equipos"},
    "Directory": {"fr": "Annuaire", "de": "Verzeichnis", "es": "Directorio"},
    "Photos": {"fr": "Photos", "de": "Fotos", "es": "Fotos"},
    "Settings": {"fr": "Paramètres", "de": "Einstellungen", "es": "Configuración"},
    "Sign out": {"fr": "Se déconnecter", "de": "Abmelden", "es": "Cerrar sesión"},
    "House \u2014 Manage your home": {
        "fr": "Maison \u2014 Gérez votre maison",
        "de": "Haus \u2014 Verwalten Sie Ihr Zuhause",
        "es": "Casa \u2014 Gestione su hogar",
    },
    "Sign in": {"fr": "Se connecter", "de": "Anmelden", "es": "Iniciar sesión"},
    "Beta \u2014 In development": {
        "fr": "Bêta \u2014 En développement",
        "de": "Beta \u2014 In Entwicklung",
        "es": "Beta \u2014 En desarrollo",
    },
    "Your home,": {"fr": "Votre maison,", "de": "Ihr Zuhause,", "es": "Su hogar,"},
    "organized.": {"fr": "organisée.", "de": "organisiert.", "es": "organizado."},
    "Track interventions, documents, equipment and contacts related to your home \u2014 all in one place.": {
        "fr": "Suivez les interventions, documents, équipements et contacts liés à votre maison \u2014 tout en un seul endroit.",
        "de": "Verfolgen Sie Eingriffe, Dokumente, Geräte und Kontakte rund um Ihr Zuhause \u2014 alles an einem Ort.",
        "es": "Rastree intervenciones, documentos, equipos y contactos relacionados con su hogar \u2014 todo en un solo lugar.",
    },
    "Open the app": {"fr": "Ouvrir l'application", "de": "App öffnen", "es": "Abrir la aplicación"},
    "Interaction log": {"fr": "Journal d'interactions", "de": "Interaktionsprotokoll", "es": "Registro de interacciones"},
    "Notes, interventions, expenses \u2014 the full history of your home.": {
        "fr": "Notes, interventions, dépenses \u2014 l'historique complet de votre maison.",
        "de": "Notizen, Eingriffe, Ausgaben \u2014 die vollständige Geschichte Ihres Zuhauses.",
        "es": "Notas, intervenciones, gastos \u2014 el historial completo de su hogar.",
    },
    "Invoices, warranties, plans \u2014 centralized and easy to find.": {
        "fr": "Factures, garanties, plans \u2014 centralisés et faciles à retrouver.",
        "de": "Rechnungen, Garantien, Pläne \u2014 zentralisiert und leicht auffindbar.",
        "es": "Facturas, garantías, planos \u2014 centralizados y fáciles de encontrar.",
    },
    "Track the status and maintenance of each piece of equipment.": {
        "fr": "Suivez l'état et la maintenance de chaque équipement.",
        "de": "Verfolgen Sie den Status und die Wartung jedes Geräts.",
        "es": "Rastree el estado y mantenimiento de cada equipo.",
    },
    "Organize by room, floor or outdoor space.": {
        "fr": "Organisez par pièce, étage ou espace extérieur.",
        "de": "Organisieren Sie nach Raum, Etage oder Außenbereich.",
        "es": "Organice por habitación, piso o espacio exterior.",
    },
    "Contacts & Contractors": {
        "fr": "Contacts et prestataires",
        "de": "Kontakte und Handwerker",
        "es": "Contactos y contratistas",
    },
    "Craftspeople, neighbors, agencies \u2014 your home address book.": {
        "fr": "Artisans, voisins, agences \u2014 votre carnet d'adresses.",
        "de": "Handwerker, Nachbarn, Agenturen \u2014 Ihr Adressbuch.",
        "es": "Artesanos, vecinos, agencias \u2014 su libreta de direcciones.",
    },
    "And more to come\u2026": {
        "fr": "Et bien plus à venir\u2026",
        "de": "Und noch mehr kommt\u2026",
        "es": "Y más por venir\u2026",
    },
    "Photos, projects, AI \u2014 in development.": {
        "fr": "Photos, projets, IA \u2014 en développement.",
        "de": "Fotos, Projekte, KI \u2014 in Entwicklung.",
        "es": "Fotos, proyectos, IA \u2014 en desarrollo.",
    },
    "All rights reserved": {
        "fr": "Tous droits réservés",
        "de": "Alle Rechte vorbehalten",
        "es": "Todos los derechos reservados",
    },
    "Sign in to your workspace": {
        "fr": "Connectez-vous à votre espace",
        "de": "Melden Sie sich in Ihrem Arbeitsbereich an",
        "es": "Inicie sesión en su espacio de trabajo",
    },
    "Email": {"fr": "Email", "de": "E-Mail", "es": "Correo electrónico"},
    "Password": {"fr": "Mot de passe", "de": "Passwort", "es": "Contraseña"},
    "Back to home": {"fr": "Retour à l'accueil", "de": "Zurück zur Startseite", "es": "Volver al inicio"},
    # ---------------------------------------------------------------------------
    # API response strings — accounts
    # ---------------------------------------------------------------------------
    "Email and password are required.": {
        "fr": "L'email et le mot de passe sont requis.",
        "de": "E-Mail und Passwort sind erforderlich.",
        "es": "El correo electrónico y la contraseña son obligatorios.",
    },
    "Invalid credentials.": {
        "fr": "Identifiants invalides.",
        "de": "Ungültige Anmeldedaten.",
        "es": "Credenciales inválidas.",
    },
    "Login successful.": {
        "fr": "Connexion réussie.",
        "de": "Anmeldung erfolgreich.",
        "es": "Inicio de sesión exitoso.",
    },
    "Logout successful.": {
        "fr": "Déconnexion réussie.",
        "de": "Abmeldung erfolgreich.",
        "es": "Cierre de sesión exitoso.",
    },
    "new_password and confirm_password are required.": {
        "fr": "new_password et confirm_password sont requis.",
        "de": "new_password und confirm_password sind erforderlich.",
        "es": "new_password y confirm_password son obligatorios.",
    },
    "Password must be at least 8 characters.": {
        "fr": "Le mot de passe doit contenir au moins 8 caractères.",
        "de": "Das Passwort muss mindestens 8 Zeichen lang sein.",
        "es": "La contraseña debe tener al menos 8 caracteres.",
    },
    "Passwords do not match.": {
        "fr": "Les mots de passe ne correspondent pas.",
        "de": "Die Passwörter stimmen nicht überein.",
        "es": "Las contraseñas no coinciden.",
    },
    "Password updated successfully.": {
        "fr": "Mot de passe mis à jour avec succès.",
        "de": "Passwort erfolgreich aktualisiert.",
        "es": "Contraseña actualizada correctamente.",
    },
    "No avatar to delete.": {
        "fr": "Aucun avatar à supprimer.",
        "de": "Kein Avatar zum Löschen.",
        "es": "No hay avatar que eliminar.",
    },
    "Avatar removed.": {
        "fr": "Avatar supprimé.",
        "de": "Avatar entfernt.",
        "es": "Avatar eliminado.",
    },
    "No file was submitted.": {
        "fr": "Aucun fichier n'a été soumis.",
        "de": "Es wurde keine Datei übermittelt.",
        "es": "No se envió ningún archivo.",
    },
    "File size exceeds 2 MB limit.": {
        "fr": "La taille du fichier dépasse la limite de 2 Mo.",
        "de": "Die Dateigröße überschreitet das Limit von 2 MB.",
        "es": "El tamaño del archivo supera el límite de 2 MB.",
    },
    # ---------------------------------------------------------------------------
    # API response strings — households
    # ---------------------------------------------------------------------------
    "Only household owners can update.": {
        "fr": "Seuls les propriétaires du foyer peuvent modifier.",
        "de": "Nur Haushaltsinhaber können aktualisieren.",
        "es": "Solo los propietarios del hogar pueden actualizar.",
    },
    "Only household owners can delete.": {
        "fr": "Seuls les propriétaires du foyer peuvent supprimer.",
        "de": "Nur Haushaltsinhaber können löschen.",
        "es": "Solo los propietarios del hogar pueden eliminar.",
    },
    "You are not a member of this household.": {
        "fr": "Vous n'êtes pas membre de ce foyer.",
        "de": "Sie sind kein Mitglied dieses Haushalts.",
        "es": "No es miembro de este hogar.",
    },
    "Cannot leave household as the last owner.": {
        "fr": "Impossible de quitter le foyer en tant que dernier propriétaire.",
        "de": "Als letzter Inhaber kann der Haushalt nicht verlassen werden.",
        "es": "No puede abandonar el hogar siendo el último propietario.",
    },
    "Only household owners can invite members.": {
        "fr": "Seuls les propriétaires du foyer peuvent inviter des membres.",
        "de": "Nur Haushaltsinhaber können Mitglieder einladen.",
        "es": "Solo los propietarios del hogar pueden invitar miembros.",
    },
    "Email is required.": {
        "fr": "L'email est requis.",
        "de": "E-Mail ist erforderlich.",
        "es": "El correo electrónico es obligatorio.",
    },
    "No user found with that email address.": {
        "fr": "Aucun utilisateur trouvé avec cette adresse email.",
        "de": "Kein Benutzer mit dieser E-Mail-Adresse gefunden.",
        "es": "No se encontró ningún usuario con esa dirección de correo electrónico.",
    },
    "User is already a member of this household.": {
        "fr": "L'utilisateur est déjà membre de ce foyer.",
        "de": "Der Benutzer ist bereits Mitglied dieses Haushalts.",
        "es": "El usuario ya es miembro de este hogar.",
    },
    "User successfully added to household.": {
        "fr": "Utilisateur ajouté au foyer avec succès.",
        "de": "Benutzer erfolgreich zum Haushalt hinzugefügt.",
        "es": "Usuario añadido al hogar correctamente.",
    },
    "user_id is required.": {
        "fr": "user_id est requis.",
        "de": "user_id ist erforderlich.",
        "es": "user_id es obligatorio.",
    },
    "User is not a member of this household.": {
        "fr": "L'utilisateur n'est pas membre de ce foyer.",
        "de": "Der Benutzer ist kein Mitglied dieses Haushalts.",
        "es": "El usuario no es miembro de este hogar.",
    },
    "Cannot remove the last owner of the household.": {
        "fr": "Impossible de supprimer le dernier propriétaire du foyer.",
        "de": "Der letzte Inhaber des Haushalts kann nicht entfernt werden.",
        "es": "No se puede eliminar al último propietario del hogar.",
    },
    "user_id and role are required.": {
        "fr": "user_id et role sont requis.",
        "de": "user_id und role sind erforderlich.",
        "es": "user_id y role son obligatorios.",
    },
    "Invalid role. Must be owner or member.": {
        "fr": "Rôle invalide. Doit être owner ou member.",
        "de": "Ungültige Rolle. Muss owner oder member sein.",
        "es": "Rol inválido. Debe ser owner o member.",
    },
    "Cannot demote the last owner of the household.": {
        "fr": "Impossible de rétrograder le dernier propriétaire du foyer.",
        "de": "Der letzte Inhaber des Haushalts kann nicht herabgestuft werden.",
        "es": "No se puede degradar al último propietario del hogar.",
    },
    # ---------------------------------------------------------------------------
    # API response strings — electricity
    # ---------------------------------------------------------------------------
    "electricity api ready": {
        "fr": "API électricité prête",
        "de": "Elektrizitäts-API bereit",
        "es": "API de electricidad lista",
    },
    "Cannot delete breaker with active circuits.": {
        "fr": "Impossible de supprimer un disjoncteur avec des circuits actifs.",
        "de": "Ein Leitungsschutzschalter mit aktiven Stromkreisen kann nicht gelöscht werden.",
        "es": "No se puede eliminar un disyuntor con circuitos activos.",
    },
    "Cannot delete circuit with active usage point links.": {
        "fr": "Impossible de supprimer un circuit avec des liens de points d'usage actifs.",
        "de": "Ein Stromkreis mit aktiven Nutzungspunktverbindungen kann nicht gelöscht werden.",
        "es": "No se puede eliminar un circuito con enlaces de puntos de uso activos.",
    },
    "Cannot delete usage point with active circuit link.": {
        "fr": "Impossible de supprimer un point d'usage avec un lien de circuit actif.",
        "de": "Ein Nutzungspunkt mit aktiver Stromkreisverbindung kann nicht gelöscht werden.",
        "es": "No se puede eliminar un punto de uso con un enlace de circuito activo.",
    },
    "Cannot delete resource with active dependencies.": {
        "fr": "Impossible de supprimer une ressource avec des dépendances actives.",
        "de": "Eine Ressource mit aktiven Abhängigkeiten kann nicht gelöscht werden.",
        "es": "No se puede eliminar un recurso con dependencias activas.",
    },
    "Not found.": {
        "fr": "Introuvable.",
        "de": "Nicht gefunden.",
        "es": "No encontrado.",
    },
}

MULTILINE_WELCOME = {
    "fr": "\\n                Bienvenue, %(name)s\\n            ",
    "de": "\\n                Willkommen zurück, %(name)s\\n            ",
    "es": "\\n                Bienvenido de nuevo, %(name)s\\n            ",
}

MULTILINE_SECTION = {
    "fr": "\\n                La section <strong>%(section)s</strong> est en cours de migration depuis l'ancienne application.\\n            ",
    "de": "\\n                Der Abschnitt <strong>%(section)s</strong> wird von der Legacy-App migriert.\\n            ",
    "es": "\\n                La sección <strong>%(section)s</strong> está siendo migrada desde la aplicación heredada.\\n            ",
}


def unescape_po(s: str) -> str:
    return s.replace('\\"', '"').replace("\\n", "\n").replace("\\t", "\t").replace("\\\\", "\\")


def escape_po(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t")


def process_po_file(lang: str) -> None:
    path = f"locale/{lang}/LC_MESSAGES/django.po"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")
    result = []
    i = 0
    replaced = 0
    fuzzy_cleared = 0

    while i < len(lines):
        line = lines[i]

        # Remove fuzzy flags and stale msgid comments
        if line.startswith("#, fuzzy"):
            fuzzy_cleared += 1
            i += 1
            # Skip any #| lines following the fuzzy flag
            while i < len(lines) and lines[i].startswith("#|"):
                i += 1
            continue

        # Single-line msgid
        if line.startswith('msgid "') and not line.startswith("msgid_plural"):
            match = re.match(r'^msgid "(.*)"$', line)
            if match:
                raw_val = match.group(1)
                key = unescape_po(raw_val)
                if key in TRANSLATIONS and lang in TRANSLATIONS[key]:
                    translation = TRANSLATIONS[key][lang]
                    result.append(line)
                    i += 1
                    # Collect and skip the msgstr block
                    while i < len(lines) and (
                        lines[i].startswith("msgstr") or
                        (lines[i].startswith('"') and result and result[-1].startswith("msgstr"))
                    ):
                        i += 1
                    escaped = escape_po(translation)
                    result.append(f'msgstr "{escaped}"')
                    replaced += 1
                    continue

        result.append(line)
        i += 1

    new_content = "\n".join(result)

    # ---- Multi-line: Welcome back ----
    welcome_pattern = re.compile(
        r'(msgid ""\n"\\n"\n"                Welcome back, %\(name\)s\\n"\n"            "\n)msgstr ""',
        re.MULTILINE,
    )
    repl = r'\1msgstr "' + MULTILINE_WELCOME[lang] + '"'
    new_content, n = welcome_pattern.subn(repl, new_content)
    if n:
        print(f"  [{lang}] Welcome back block: replaced")
        replaced += 1
    else:
        print(f"  [{lang}] Welcome back block: NOT FOUND (check manually)")

    # ---- Multi-line: Section placeholder ----
    section_pattern = re.compile(
        r'(msgid ""\n"\\n"\n"                The <strong>%\(section\)s</strong> section is being migrated from the legacy app\.\\n"\n"            "\n)msgstr ""',
        re.MULTILINE,
    )
    section_repl = r'\1msgstr "' + MULTILINE_SECTION[lang] + '"'
    new_content, n2 = section_pattern.subn(section_repl, new_content)
    if n2:
        print(f"  [{lang}] Section placeholder block: replaced")
        replaced += 1
    else:
        print(f"  [{lang}] Section placeholder block: NOT FOUND (check manually)")

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"  [{lang}] {path} — {replaced} msgstr filled, {fuzzy_cleared} fuzzy flags removed")


if __name__ == "__main__":
    for lang in ["fr", "de", "es"]:
        print(f"\nProcessing {lang}...")
        process_po_file(lang)
    print("\nDone!")
