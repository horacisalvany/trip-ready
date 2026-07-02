import { Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  user,
} from '@angular/fire/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$ = user(this.auth);
  isAuthenticated$: Observable<boolean> = this.user$.pipe(map((u) => !!u));

  constructor(private auth: Auth, private db: AngularFireDatabase) {}

  sanitizeEmail(email: string): string {
    return email.replace(/\./g, ',');
  }

  async registerEmailLookup(email: string, uid: string): Promise<void> {
    const sanitized = this.sanitizeEmail(email);
    await this.db.object(`userEmails/${sanitized}`).set(uid);
  }

  async login(email: string, password: string) {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    if (result.user?.email) {
      await this.registerEmailLookup(result.user.email, result.user.uid);
    }
    return result;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    if (result.user?.email) {
      await this.registerEmailLookup(result.user.email, result.user.uid);
    }
    return result;
  }

  async register(email: string, password: string) {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    if (result.user?.email) {
      await this.registerEmailLookup(result.user.email, result.user.uid);
    }
    return result;
  }

  logout() {
    return signOut(this.auth);
  }
}
