import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, take, timeout } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { List } from '../views/lists/list';
import { AuthService } from './auth.service';

/** One item the recommender thinks the list is missing. */
export interface Suggestion {
  name: string;
  /** A section name, matched against the list's own on the client. */
  section: string;
  reason: string;
}

/*
  Every way a request can end, as a value rather than an error. The dialog only
  has to render one of these, and because the observable never errors, its
  spinner never has a path that leaves it spinning.
 */
export type SuggestOutcome =
  | { kind: 'ok'; suggestions: Suggestion[] }
  /** The per-user daily cap — not an error, a "try tomorrow". */
  | { kind: 'quota' }
  /** Anything else: network, timeout, a service failure. One message covers all. */
  | { kind: 'error' }
  /** Nothing was sent; the user is already on their way to /login. */
  | { kind: 'signed-out' };

/*
  Long enough for a Cloud Run cold start plus a model call, which together take
  a few seconds on a bad day; short enough that a dead connection still ends in
  a message the user can retry from.
 */
export const RECOMMENDER_TIMEOUT_MS = 30000;

interface RecommendationRequest {
  listTitle: string;
  tripNote?: string;
  sections: { name: string; items: string[] }[];
}

/*
  The request body for a list: its title, its note when it has one, and each
  section by name with its item names. Marks stay behind — whether something is
  packed has no bearing on whether it belongs on the list.
 */
function requestFor(list: List): RecommendationRequest {
  return {
    listTitle: list.title,
    ...(list.tripNote ? { tripNote: list.tripNote } : {}),
    sections: list.sections.map((section) => ({
      name: section.title,
      items: section.items.map((item) => item.name),
    })),
  };
}

/*
  Asks the recommender service (F12, `/recommender-service`) for items a list
  might be missing. It only reads: what the user accepts is written afterwards
  by ListComponent, through the same paths as any other new item.
 */
@Injectable({ providedIn: 'root' })
export class RecommenderService {
  private readonly endpoint = `${environment.recommenderUrl}/api/recommendations`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  suggest(list: List): Observable<SuggestOutcome> {
    return this.authService.user$.pipe(
      /*
        One request, one user. Not a write, but the same rule as one (see
        CLAUDE.md): left open, a later sign-in would re-send this request under
        the new user, and spend their quota on someone else's list.
       */
      take(1),
      switchMap((user): Observable<SuggestOutcome> => {
        if (!user) return of({ kind: 'signed-out' });
        return from(user.getIdToken()).pipe(
          switchMap((token) =>
            this.http.post<{ suggestions?: Suggestion[] }>(this.endpoint, requestFor(list), {
              headers: { Authorization: `Bearer ${token}` },
            })
          ),
          timeout(RECOMMENDER_TIMEOUT_MS),
          map((response) => ({ kind: 'ok', suggestions: response?.suggestions ?? [] }))
        );
      }),
      catchError((err) =>
        of<SuggestOutcome>(
          err instanceof HttpErrorResponse && err.status === 429
            ? { kind: 'quota' }
            : { kind: 'error' }
        )
      )
    );
  }
}
