import { describe, expect, it } from 'vitest';
import { UNTRIAGED } from '@/lib/api/documents';
import {
  DEFAULT_PURPOSES,
  purposeParam,
  purposesFromParam,
  togglePurpose,
} from './purposes';

describe('la galerie s’ouvre sur les souvenirs', () => {
  it('ne s’ouvre pas sur l’ensemble', () => {
    // Une photothèque en vrac mélange le numéro de série d’une chaudière et un
    // anniversaire : elle ne répond à aucune des deux questions qu’on vient y poser.
    expect([...DEFAULT_PURPOSES]).toEqual(['memory']);
  });
});

describe('togglePurpose', () => {
  it('ajoute une intention sans retirer les autres', () => {
    expect(togglePurpose(['memory'], 'technical')).toEqual(['technical', 'memory']);
  });

  it('garde l’ordre de l’écran quel que soit l’ordre des clics', () => {
    // Sans ça, la même sélection s’écrirait de deux façons — donc deux clés de
    // cache et deux requêtes pour un écran identique.
    expect(togglePurpose(['memory'], 'observation')).toEqual(
      togglePurpose(['observation'], 'memory'),
    );
  });

  it('retire une intention déjà cochée', () => {
    expect(togglePurpose(['technical', 'memory'], 'memory')).toEqual(['technical']);
  });

  it('revient à « toutes » quand on décoche la dernière', () => {
    // Jamais une galerie vide : une liste vide sans rien à décocher ne dit ni
    // pourquoi elle est vide, ni comment en sortir.
    expect(togglePurpose(['memory'], 'memory')).toEqual([]);
  });

  it('« toutes » efface la sélection', () => {
    expect(togglePurpose(['memory', 'technical'], '')).toEqual([]);
  });

  it('« à trier » chasse les intentions, et réciproquement', () => {
    // Ce n’est pas une quatrième intention mais l’absence de choix, et elle ouvre
    // un autre écran — la file par grappes. Le serveur refuse d’ailleurs le mélange.
    expect(togglePurpose(['memory', 'technical'], UNTRIAGED)).toEqual([UNTRIAGED]);
    expect(togglePurpose([UNTRIAGED], 'memory')).toEqual(['memory']);
  });

  it('« à trier » se décoche elle-même', () => {
    expect(togglePurpose([UNTRIAGED], UNTRIAGED)).toEqual([]);
  });
});

describe('purposeParam', () => {
  it('omet la clé pour « toutes » plutôt que d’envoyer un vide', () => {
    // `?purpose=` est refusé en 400 côté serveur, pour qu’un paramètre oublié ne
    // puisse jamais se lire comme un filtre.
    expect(purposeParam([])).toBeUndefined();
  });

  it('joint les intentions en un seul appel', () => {
    expect(purposeParam(['technical', 'memory'])).toBe('technical,memory');
  });
});

describe('purposesFromParam — une notification doit mener quelque part', () => {
  it('lit l’étagère annoncée par le lien', () => {
    expect(purposesFromParam('technical')).toEqual(['technical']);
    expect(purposesFromParam(UNTRIAGED)).toEqual([UNTRIAGED]);
  });

  it('lit une liste', () => {
    expect(purposesFromParam('memory,technical')).toEqual(['technical', 'memory']);
  });

  it('retombe sur le défaut quand il n’y a rien à lire', () => {
    expect(purposesFromParam(null)).toBeNull();
    expect(purposesFromParam('')).toBeNull();
  });

  it('ignore ce qu’il ne comprend pas plutôt que d’afficher une erreur', () => {
    // Un lien vieilli doit retomber sur un écran normal : personne ne peut rien
    // faire d’un message d’erreur reçu par notification.
    expect(purposesFromParam('souvenir')).toBeNull();
    expect(purposesFromParam('memory,souvenir')).toEqual(['memory']);
  });
});
