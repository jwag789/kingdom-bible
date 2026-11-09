// Where shared family voices are kept: a Supabase project's URL and its public ("anon") key.
// The anon key is meant to be public; the project's storage rules decide what it may do
// (see docs/supabase.sql). Leave these empty and "Send to family" stays switched off.

export const SUPABASE = {
  url: 'https://sdciajiknpljdhcsubiw.supabase.co',
  key: 'sb_publishable_uIkdKEVpyq2G0hMcdHFFFw_xbRhrYE5',
  bucket: 'voices',
};

// Where the web version lives. A family-voice link sent from the iPhone or Android app points
// here, since the app's own address (capacitor://localhost) means nothing on someone else's phone.
export const SITE = 'https://jwag789.github.io/kingdom-bible/';
