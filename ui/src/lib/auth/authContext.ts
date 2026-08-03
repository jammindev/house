import { createContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  /** Nom d'affichage canonique, calculé par le serveur (`User.full_name`) :
   * `display_name`, sinon prénom+nom, sinon l'email. Toute surface qui nomme
   * l'utilisateur lit ce champ — ne pas recomposer la règle au point d'appel. */
  full_name: string;
  active_household: string | null;
  locale?: string;
  is_staff?: boolean;
  avatar?: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
