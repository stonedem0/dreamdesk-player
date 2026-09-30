/// <reference types="vite/client" />

// dreamdesk-ui ships JavaScript with no bundled declarations. Declaring the
// module keeps it as `any` rather than a hard resolution error - narrow this to
// a real signature if the package ever gains types.
declare module 'dreamdesk-ui';
