import { Injectable } from '@angular/core';
import * as Forge from 'node-forge';

@Injectable({
  providedIn: 'root',
})
export class RsaService {
  publicKey: string = `-----BEGIN RSA PUBLIC KEY-----
  MIGJAoGBAIixcCiyJ3THmzotd5V1f1+zZZ52CLu3DXb+DPgCB2fJsh8xZopHHDld
  ew/Ks0HHujwI0jkOWfH9s81kb6yjl4MAjCZZPsC6Nkv+TfZ6ZHxvpWfjSQLU7h/Y
  DXyH3j0XmnQuzx9Bn1WSplkF/eEP3tlWM58GLEubmdeMosicuLzFAgMBAAE=
  -----END RSA PUBLIC KEY-----`

  constructor() {}

  encryptWithPublicKey(valueToEncrypt: string): string {
    const rsa = Forge.pki.publicKeyFromPem(this.publicKey)
    return window.btoa(
      rsa.encrypt(
        Forge.util.encodeUtf8(valueToEncrypt.toString())))
  }
}