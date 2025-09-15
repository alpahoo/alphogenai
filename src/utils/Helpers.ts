import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { ENV_CLIENT } from '@/libs/Env';

import { AppConfig } from './AppConfig';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MILLISECONDS_IN_ONE_DAY = 86_400_000;

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  if (ENV_CLIENT.SITE_URL) {
    return ENV_CLIENT.SITE_URL;
  }

  if (ENV_CLIENT.BASE_URL) {
    return ENV_CLIENT.BASE_URL;
  }

  if (ENV_CLIENT.APP_URL) {
    return ENV_CLIENT.APP_URL;
  }

  return 'http://localhost:3000';
};

export const getI18nPath = (url: string, locale: string) => {
  if (locale === AppConfig.defaultLocale) {
    return url;
  }

  return `/${locale}${url}`;
};
