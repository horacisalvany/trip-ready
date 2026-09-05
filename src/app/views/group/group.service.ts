import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { from, Observable, of, switchMap } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { Group } from './group';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  constructor(
    private db: AngularFireDatabase,
    private authService: AuthService
  ) {}

  private userPath(): Observable<string | null> {
    return this.authService.user$.pipe(
      map((user) => (user ? `users/${user.uid}` : null))
    );
  }

  getGroups(): Observable<Group[]> {
    return this.userPath().pipe(
      switchMap((path) => {
        if (!path) return of([]);
        return this.db
          .list(`${path}/groups`)
          .snapshotChanges()
          .pipe(
            map((changes) =>
              changes.map((c) => {
                const data = c.payload.val() as any;
                return {
                  id: c.payload.key!,
                  title: data?.title ?? 'Untitled',
                  items: data?.items ?? [],
                } as Group;
              })
            )
          );
      })
    );
  }

  updateGroup(id: string, updatedItems: string[]): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(
          this.db
            .list(`${path}/groups`)
            .update(id, { items: updatedItems })
        );
      })
    );
  }

  /*
    `update` with the title alone rather than `set`, so the group keeps its items.
    The id is the Firebase key and is untouched by a rename.
   */
  renameGroup(id: string, title: string): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(this.db.list(`${path}/groups`).update(id, { title }));
      })
    );
  }

  addGroup(title: string, items: string[] = []): Observable<string | null> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(null);
        return from(
          this.db.list(`${path}/groups`).push({ title, items })
        ).pipe(map((ref) => ref.key));
      })
    );
  }

  deleteGroup(id: string): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(this.db.list(`${path}/groups`).remove(id));
      })
    );
  }
}
