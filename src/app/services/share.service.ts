import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { List } from '../views/lists/list';
import { Section } from '../views/list/section';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ShareService {
  constructor(
    private db: AngularFireDatabase,
    private authService: AuthService
  ) {}

  private parseSections(sectionsObj: any): Section[] {
    if (!sectionsObj || typeof sectionsObj !== 'object') return [];
    return Object.keys(sectionsObj).map((key) => ({
      id: key,
      title: sectionsObj[key]?.title ?? 'Untitled',
      items: sectionsObj[key]?.items ?? [],
      sourceGroupId: sectionsObj[key]?.sourceGroupId,
    }));
  }

  lookupUserByEmail(email: string): Observable<string | null> {
    const sanitized = this.authService.sanitizeEmail(email);
    return this.db
      .object<string>(`userEmails/${sanitized}`)
      .valueChanges()
      .pipe(
        take(1),
        map((uid) => uid ?? null)
      );
  }

  shareList(
    listId: string,
    targetUid: string,
    targetEmail: string
  ): Observable<void> {
    return this.authService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (!user) return of(undefined as void);
        const ownerUid = user.uid;
        const ownerEmail = user.email ?? '';

        // 1. Check whether the list is already shared
        return this.db
          .object(`sharedLists/${listId}`)
          .valueChanges()
          .pipe(
            take(1),
            switchMap((existingSharedListData: any) => {
              if (existingSharedListData) {
                // Already shared: merge the new recipient into sharedWith
                // instead of overwriting the whole node (would drop other recipients)
                return forkJoin([
                  from(
                    this.db
                      .object(`sharedLists/${listId}/sharedWith/${targetUid}`)
                      .set(targetEmail)
                  ),
                  from(this.db.object(`users/${targetUid}/sharedListIds/${listId}`).set(true)),
                ]).pipe(map(() => undefined as void));
              }

              // 2. Not yet shared: read the current private list data
              return this.db
                .object(`users/${ownerUid}/lists/${listId}`)
                .valueChanges()
                .pipe(
                  take(1),
                  switchMap((listData: any) => {
                    if (!listData) return of(undefined as void);

                    // 3. Build the shared list object
                    const sharedListData = {
                      title: listData.title,
                      sections: listData.sections ?? {},
                      ownerUid,
                      ownerEmail,
                      sharedWith: { [targetUid]: targetEmail },
                    };

                    // 4. Write all paths in parallel: publish to sharedLists,
                    //    register for both owner and target, remove from owner's personal lists
                    return forkJoin([
                      from(this.db.object(`sharedLists/${listId}`).set(sharedListData)),
                      from(this.db.object(`users/${ownerUid}/sharedListIds/${listId}`).set(true)),
                      from(this.db.object(`users/${targetUid}/sharedListIds/${listId}`).set(true)),
                      from(this.db.object(`users/${ownerUid}/lists/${listId}`).remove()),
                    ]).pipe(map(() => undefined as void));
                  })
                );
            })
          );
      })
    );
  }

  deleteSharedList(listId: string): Observable<void> {
    return this.authService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (!user) return of(undefined as void);

        // Read the shared list to get all users who have references
        return this.db
          .object(`sharedLists/${listId}`)
          .valueChanges()
          .pipe(
            take(1),
            switchMap((data: any) => {
              if (!data) return of(undefined as void);

              // Collect all UIDs that have references: owner + all sharedWith users
              const uids = new Set<string>();
              if (data.ownerUid) uids.add(data.ownerUid);
              if (data.sharedWith) {
                Object.keys(data.sharedWith).forEach((uid) => uids.add(uid));
              }

              // Restore list to owner's personal lists, remove sharedListIds for all users,
              // and remove the shared list node itself
              const { ownerUid: owner, title, sections } = data;
              const writes: Observable<any>[] = [
                from(this.db.object(`sharedLists/${listId}`).remove()),
                from(this.db.object(`users/${owner}/lists/${listId}`).set({ title, sections: sections ?? {} })),
                ...Array.from(uids).map((uid) =>
                  from(this.db.object(`users/${uid}/sharedListIds/${listId}`).remove())
                ),
              ];

              return forkJoin(writes).pipe(map(() => undefined as void));
            })
          );
      })
    );
  }

  unshareList(listId: string, targetUid: string): Observable<void> {
    return forkJoin([
      from(
        this.db
          .object(`sharedLists/${listId}/sharedWith/${targetUid}`)
          .remove()
      ),
      from(
        this.db
          .object(`users/${targetUid}/sharedListIds/${listId}`)
          .remove()
      ),
    ]).pipe(map(() => undefined as void));
  }

  getSharedLists(): Observable<List[]> {
    return this.authService.user$.pipe(
      switchMap((user) => {
        if (!user) return of([]);
        return this.db
          .object(`users/${user.uid}/sharedListIds`)
          .valueChanges()
          .pipe(
            take(1),
            switchMap((sharedListIds: any) => {
              if (!sharedListIds || typeof sharedListIds !== 'object') {
                return of([]);
              }
              const listIds = Object.keys(sharedListIds);
              if (listIds.length === 0) return of([]);

              return forkJoin(
                listIds.map((id) =>
                  this.db
                    .object(`sharedLists/${id}`)
                    .valueChanges()
                    .pipe(
                      take(1),
                      map((data: any) => {
                        if (!data) return null;
                        return {
                          id,
                          title: data.title,
                          sections: this.parseSections(data.sections),
                          ownerUid: data.ownerUid,
                          ownerEmail: data.ownerEmail,
                          sharedWith: data.sharedWith,
                          isShared: true,
                        } as List;
                      })
                    )
                )
              ).pipe(
                map((lists) => lists.filter((l): l is List => l !== null))
              );
            })
          );
      })
    );
  }
}
