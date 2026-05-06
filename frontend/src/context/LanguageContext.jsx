import React, { createContext, useContext, useEffect, useState } from 'react';

const translations = {
  en: {
    appName: 'AI Marketing Studio',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordMinFormat: 'At least 6 characters',
    loading: 'Loading...',
    loginTitle: 'Sign in to your workspace',
    loginGreeting: 'Welcome back',
    loginButton: 'Sign In',
    loginTab: 'Login',
    signInAction: 'Sign in',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    forgotPasswordLink: 'Forgot password?',
    registerTitle: 'Create your studio account',
    registerGreeting: 'Launch your first campaign',
    registerButton: 'Create Account',
    registerTab: 'Register',
    createAccountAction: 'Create account',
    confirmPasswordLabel: 'Confirm password',
    hasAccount: 'Already have an account?',
    signInInstead: 'Sign in instead',
    forgotTitle: 'Reset your password',
    forgotSubtitle: 'Enter your email and we will send you a secure reset link.',
    forgotButton: 'Send reset link',
    backToLogin: 'Back to sign in',
    resetTitle: 'Choose a new password',
    resetSubtitle: 'Create a fresh password to get back into your studio.',
    resetButton: 'Update password',
    newPasswordLabel: 'New password',
    welcomeBack: 'Welcome back',
    campaigns: 'Campaigns',
    assets: 'Assets',
    generations: 'Generations',
    signOut: 'Sign out',
    dashboardHint: 'Your studio is ready for the next launch.',
    aiAssistant: 'AI Assistant',
    chatDescription: 'Generate ideas and supporting copy with AI.',
    startChat: 'Start chat',
    chatTitle: 'AI Assistant',
    chatPlaceholder: 'Message the assistant...',
    send: 'Send',
    clearChat: 'Clear',
    aiThinking: 'AI is thinking...',
    newChat: 'New chat',
    noHistory: 'No conversations yet',
    chatWelcome: 'How can I help today?',
    chatWelcomeSub: 'Start a conversation with your AI marketing assistant.',
    chatDisclaimer: 'AI can make mistakes. Review important information.',
    errorRequired: 'Please fill in all required fields.',
    errorEmail: 'Please enter a valid email address.',
    errorPassLength: 'Password must be at least 6 characters.',
    errorPassMatch: 'Passwords do not match.',
    errorChat: 'Something went wrong. Please try again.',
    sessionExpired: 'Your session has expired. Please log in again.',
  },
  sq: {
    appName: 'AI Marketing Studio',
    emailLabel: 'Adresa e email-it',
    emailPlaceholder: 'ju@shembull.com',
    passwordLabel: 'Fjalekalimi',
    passwordPlaceholder: 'Shkruani fjalekalimin',
    passwordMinFormat: 'Te pakten 6 karaktere',
    loading: 'Duke ngarkuar...',
    loginTitle: 'Hyni ne studion tuaj',
    loginGreeting: 'Mire se u kthyete',
    loginButton: 'Hyr',
    loginTab: 'Hyr',
    signInAction: 'Hyr',
    noAccount: 'Nuk keni llogari?',
    createOne: 'Krijoni nje',
    forgotPasswordLink: 'Keni harruar fjalekalimin?',
    registerTitle: 'Krijoni llogarine e studios',
    registerGreeting: 'Nisni fushaten tuaj te pare',
    registerButton: 'Krijo llogari',
    registerTab: 'Regjistrohu',
    createAccountAction: 'Krijo llogari',
    confirmPasswordLabel: 'Konfirmo fjalekalimin',
    hasAccount: 'Keni tashme nje llogari?',
    signInInstead: 'Hyni ne vend te kesaj',
    forgotTitle: 'Rivendosni fjalekalimin',
    forgotSubtitle: 'Vendosni email-in dhe do t\'ju dergojme nje link te sigurt.',
    forgotButton: 'Dergo linkun',
    backToLogin: 'Kthehu te hyrja',
    resetTitle: 'Vendosni nje fjalekalim te ri',
    resetSubtitle: 'Krijoni nje fjalekalim te ri per t\'u kthyer ne studio.',
    resetButton: 'Perditeso fjalekalimin',
    newPasswordLabel: 'Fjalekalimi i ri',
    welcomeBack: 'Mire se u kthyete',
    campaigns: 'Fushata',
    assets: 'Asete',
    generations: 'Gjenerime',
    signOut: 'Dil',
    dashboardHint: 'Studioja juaj eshte gati per fushaten e radhes.',
    aiAssistant: 'Asistenti AI',
    chatDescription: 'Gjeneroni ide dhe tekst mbeshtetes me AI.',
    startChat: 'Fillo biseden',
    chatTitle: 'Asistenti AI',
    chatPlaceholder: 'Shkruani nje mesazh...',
    send: 'Dergo',
    clearChat: 'Pastro',
    aiThinking: 'AI po mendon...',
    newChat: 'Bisede e re',
    noHistory: 'Nuk ka biseda ende',
    chatWelcome: 'Si mund t\'ju ndihmoj sot?',
    chatWelcomeSub: 'Filloni nje bisede me asistentin tuaj te marketingut.',
    chatDisclaimer: 'AI mund te beje gabime. Verifikoni informacionin e rendesishem.',
    errorRequired: 'Ju lutemi plotesoni te gjitha fushat e kerkuara.',
    errorEmail: 'Ju lutemi vendosni nje email te vlefshem.',
    errorPassLength: 'Fjalekalimi duhet te kete te pakten 6 karaktere.',
    errorPassMatch: 'Fjalekalimet nuk perputhen.',
    errorChat: 'Dicka shkoi keq. Ju lutemi provoni perseri.',
    sessionExpired: 'Sesioni juaj ka skaduar. Ju lutemi hyni perseri.',
  },
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'en');

  useEffect(() => {
    localStorage.setItem('language', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'sq' : 'en'));
  };

  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
