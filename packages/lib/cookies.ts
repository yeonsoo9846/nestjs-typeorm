export const getCookie = ($name: string) => {
  if (typeof document !== "undefined") {
    let matches = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
          $name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") +
          "=([^;]*)",
      ),
    );

    return matches && matches[1] ? decodeURIComponent(matches[1]) : undefined;
  }
};

export const setCookie = (
  $name: string,
  $value: string,
  $options: { "max-age"?: number; expires?: number } = {},
) => {
  let options: {
    expires?: string;
    path: string;
    domain: string;
  } = {
    path: "/",
    domain: window.location.hostname,
  };

  if ($options.expires !== undefined) {
    let date = new Date();

    date.setTime(Number(date.getTime()) + $options.expires);

    options.expires = date.toUTCString();
  }

  let updatedCookie =
    encodeURIComponent($name) + "=" + encodeURIComponent($value);

  for (let optionKey in options) {
    updatedCookie += "; " + optionKey;
    // @ts-ignore
    let optionValue = options[optionKey];
    if (optionValue !== true) {
      updatedCookie += "=" + optionValue;
    }
  }

  document.cookie = updatedCookie;
};

export const deleteCookie = ($name: string) => {
  setCookie($name, "", {
    "max-age": -1,
    expires: 1000,
  });
};
