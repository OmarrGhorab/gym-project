import { cookies } from "next/headers";

import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isAppLocale, localeCookieName } from "./config";
import { getMessages } from "./messages";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: await getMessages(locale),
  };
});
