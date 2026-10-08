const en = {
  connectTitle: 'Connect your browser',
  pairingHint: 'In the web app, open Settings → Browser extension to create a pairing code.',
  apiBase: 'API address',
  codeLabel: 'Pairing code',
  codePlaceholder: 'e.g. K7M2QX9P',
  connect: 'Connect',
  disconnect: 'Disconnect',
  connectFailed: 'Could not pair with that code',
  networkFailed: 'Could not reach the ApplyForME API',
  tokenRejected: 'Token rejected — connect again',
  tasksTitle: 'Waiting for your browser',
  noTasks: 'No browser tasks yet. Start a run in the web app, then come back here.',
  refresh: 'Refresh',
  start: 'Start collecting',
  stop: 'Stop',
  keepOpen: 'Keep this panel open while it runs — tabs open in front of you.',
  consentTitle: 'Allow this site?',
  consentBody:
    'ApplyForME will open {hosts} in a visible tab and read the job listings you can see. You only confirm each site once.',
  consentAllow: 'Allow once remembered',
  consentCancel: 'Cancel',
  summary: '{done} done · {blocked} blocked · {failed} failed · {cancelled} cancelled',
  pageLabel: 'Page {page} of {cap}',
  itemsLabel: '{items} items collected',
  statusPending: 'Waiting',
  statusRunning: 'Running',
  statusDone: 'Done',
  statusBlocked: 'Blocked',
  statusFailed: 'Failed',
  statusSkipped: 'Skipped',
  statusCancelled: 'Cancelled',
  runFailed: 'Collection failed',
  pairingError: 'Pairing failed',
};

export type Strings = typeof en;

const fr: Strings = {
  connectTitle: 'Connecter ce navigateur',
  pairingHint:
    'Dans l’application web, ouvrez Paramètres → Extension navigateur pour créer un code.',
  apiBase: 'Adresse de l’API',
  codeLabel: 'Code de jumelage',
  codePlaceholder: 'ex. K7M2QX9P',
  connect: 'Connecter',
  disconnect: 'Déconnecter',
  connectFailed: 'Impossible de se connecter avec ce code',
  networkFailed: 'Impossible de joindre l’API ApplyForME',
  tokenRejected: 'Jeton refusé — reconnectez-vous',
  tasksTitle: 'En attente dans votre navigateur',
  noTasks:
    'Aucune tâche pour le moment. Lancez une collecte dans l’application web, puis revenez ici.',
  refresh: 'Actualiser',
  start: 'Lancer la collecte',
  stop: 'Arrêter',
  keepOpen: 'Gardez ce panneau ouvert pendant la collecte — les onglets s’ouvrent devant vous.',
  consentTitle: 'Autoriser ce site ?',
  consentBody:
    'ApplyForME ouvrira {hosts} dans un onglet visible et lira les offres d’emploi que vous voyez. Une seule confirmation par site.',
  consentAllow: 'Autoriser',
  consentCancel: 'Annuler',
  summary: '{done} terminées · {blocked} bloquées · {failed} échouées · {cancelled} annulées',
  pageLabel: 'Page {page} sur {cap}',
  itemsLabel: '{items} offres collectées',
  statusPending: 'En attente',
  statusRunning: 'En cours',
  statusDone: 'Terminée',
  statusBlocked: 'Bloquée',
  statusFailed: 'Échouée',
  statusSkipped: 'Ignorée',
  statusCancelled: 'Annulée',
  runFailed: 'La collecte a échoué',
  pairingError: 'Échec du jumelage',
};

export const detectLang = (): 'en' | 'fr' =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')
    ? 'fr'
    : 'en';

export const createStrings = (lang: 'en' | 'fr'): Strings => (lang === 'fr' ? fr : en);

export const format = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
