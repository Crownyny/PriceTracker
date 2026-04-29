declare module 'sockjs-client' {
  export default class SockJS {
    constructor(url: string, _protocols?: string | string[]);
    close(): void;
  }
}