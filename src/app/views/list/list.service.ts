import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { combineLatest, from, Observable, of, switchMap } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { Group } from '../group/group';
import { List } from '../lists/list';
import { Section } from './section';

export const UNGROUPED_SECTION_TITLE = 'Ungrouped';

@Injectable({
  providedIn: 'root',
})
export class ListService {
  constructor(
    private db: AngularFireDatabase,
    private authService: AuthService
  ) {}

  private userPath(): Observable<string | null> {
    return this.authService.user$.pipe(
      map((user) => (user ? `users/${user.uid}` : null))
    );
  }

  private parseSections(sectionsObj: any): Section[] {
    if (!sectionsObj || typeof sectionsObj !== 'object') return [];
    const sections = Object.keys(sectionsObj).map((key) => ({
      id: key,
      title: sectionsObj[key]?.title ?? 'Untitled',
      items: sectionsObj[key]?.items ?? [],
      sourceGroupId: sectionsObj[key]?.sourceGroupId,
    }));
    // Ensure "Ungrouped" section is always first
    sections.sort((a, b) => {
      if (a.title === UNGROUPED_SECTION_TITLE) return -1;
      if (b.title === UNGROUPED_SECTION_TITLE) return 1;
      return 0;
    });
    return sections;
  }

  getLists(): Observable<List[]> {
    return this.userPath().pipe(
      switchMap((path) => {
        if (!path) return of([]);
        return combineLatest([
          this.db.list(`${path}/lists`).snapshotChanges(),
          this.db.object(`${path}/sharedListIds`).valueChanges(),
        ]).pipe(
          map(([changes, sharedListIds]) => {
            const sharedIds = new Set(
              sharedListIds && typeof sharedListIds === 'object'
                ? Object.keys(sharedListIds)
                : []
            );
            return changes
              .filter((c) => !sharedIds.has(c.payload.key!))
              .map((c) => {
                const data = c.payload.val() as any;
                return {
                  id: c.payload.key!,
                  title: data?.title ?? 'Untitled',
                  sections: this.parseSections(data?.sections),
                } as List;
              });
          })
        );
      })
    );
  }

  getList(id: string): Observable<List | undefined> {
    return this.userPath().pipe(
      switchMap((path) => {
        if (!path) return of(undefined);
        return this.db
          .object(`${path}/lists/${id}`)
          .valueChanges()
          .pipe(
            map((data: any) => {
              if (!data) return undefined;
              return {
                id,
                title: data.title,
                sections: this.parseSections(data.sections),
              } as List;
            })
          );
      })
    );
  }

  addList(title: string): Observable<string | null> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(null);
        return from(
          this.db.list(`${path}/lists`).push({
            title,
            sections: {
              ungrouped: {
                title: UNGROUPED_SECTION_TITLE,
                items: [],
              },
            },
          })
        ).pipe(map((ref) => ref.key));
      })
    );
  }

  deleteList(id: string): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(this.db.list(`${path}/lists`).remove(id));
      })
    );
  }

  addSectionToList(listId: string, group: Group): Observable<string | null> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(null);
        const sectionData = {
          title: group.title,
          items: [...group.items],
          sourceGroupId: group.id,
        };
        return from(
          this.db.list(`${path}/lists/${listId}/sections`).push(sectionData)
        ).pipe(map((ref) => ref.key));
      })
    );
  }

  removeSectionFromList(listId: string, sectionId: string): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(
          this.db.list(`${path}/lists/${listId}/sections`).remove(sectionId)
        );
      })
    );
  }

  updateSectionItems(
    listId: string,
    sectionId: string,
    items: string[]
  ): Observable<void> {
    return this.userPath().pipe(
      take(1),
      switchMap((path) => {
        if (!path) return of(undefined as void);
        return from(
          this.db
            .object(`${path}/lists/${listId}/sections/${sectionId}`)
            .update({ items })
        );
      })
    );
  }

  getSharedList(id: string): Observable<List | undefined> {
    return this.db
      .object(`sharedLists/${id}`)
      .valueChanges()
      .pipe(
        map((data: any) => {
          if (!data) return undefined;
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
      );
  }

  updateSharedSectionItems(
    listId: string,
    sectionId: string,
    items: string[]
  ): Observable<void> {
    return from(
      this.db
        .object(`sharedLists/${listId}/sections/${sectionId}`)
        .update({ items })
    );
  }

  addSharedSectionToList(listId: string, group: Group): Observable<string | null> {
    const sectionData = {
      title: group.title,
      items: [...group.items],
      sourceGroupId: group.id,
    };
    return from(
      this.db.list(`sharedLists/${listId}/sections`).push(sectionData)
    ).pipe(map((ref) => ref.key));
  }

  removeSharedSectionFromList(listId: string, sectionId: string): Observable<void> {
    return from(
      this.db.list(`sharedLists/${listId}/sections`).remove(sectionId)
    );
  }
}
