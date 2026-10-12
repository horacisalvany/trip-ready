import {
  HttpClientTestingModule,
  HttpTestingController,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { unmarkedItems } from '../views/list/item';
import { List } from '../views/lists/list';
import { AuthService } from './auth.service';
import {
  RECOMMENDER_TIMEOUT_MS,
  RecommenderService,
  SuggestOutcome,
} from './recommender.service';

const ENDPOINT = `${environment.recommenderUrl}/api/recommendations`;

const LIST: List = {
  id: 'list1',
  title: 'Ski Andorra',
  tripNote: '1 week, Feb, 2 adults + kid',
  sections: [
    { id: 's1', title: 'Clothes', items: [{ name: 'Ski jacket', checked: true }] },
    { id: 's2', title: 'Documents', items: unmarkedItems(['Passport', 'EHIC']) },
  ],
};

describe('RecommenderService', () => {
  let service: RecommenderService;
  let http: HttpTestingController;
  let user$: BehaviorSubject<any>;

  function signedInAs(uid: string, token: string) {
    return { uid, getIdToken: () => Promise.resolve(token) };
  }

  /*
    The token is a promise, so the request only goes out once microtasks run —
    every test drives time with fakeAsync for that reason.
   */
  function suggest(list: List = LIST): { outcome: () => SuggestOutcome | undefined } {
    let outcome: SuggestOutcome | undefined;
    service.suggest(list).subscribe((o) => (outcome = o));
    flushMicrotasks();
    return { outcome: () => outcome };
  }

  function request(): TestRequest {
    return http.expectOne(ENDPOINT);
  }

  beforeEach(() => {
    user$ = new BehaviorSubject<any>(signedInAs('uid1', 'token-1'));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthService, useValue: { user$ } }],
    });
    service = TestBed.inject(RecommenderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should POST to the recommender endpoint', fakeAsync(() => {
    suggest();

    const sent = request();

    expect(sent.request.method).toBe('POST');
    sent.flush({ suggestions: [] });
  }));

  it("should attach the signed-in user's ID token", fakeAsync(() => {
    suggest();

    const sent = request();

    expect(sent.request.headers.get('Authorization')).toBe('Bearer token-1');
    sent.flush({ suggestions: [] });
  }));

  /* Item names only: marks are this app's business, not the model's. */
  it('should send the title, the note and every section with its item names', fakeAsync(() => {
    suggest();

    const sent = request();

    expect(sent.request.body).toEqual({
      listTitle: 'Ski Andorra',
      tripNote: '1 week, Feb, 2 adults + kid',
      sections: [
        { name: 'Clothes', items: ['Ski jacket'] },
        { name: 'Documents', items: ['Passport', 'EHIC'] },
      ],
    });
    sent.flush({ suggestions: [] });
  }));

  it('should leave the note out when the list has none', fakeAsync(() => {
    suggest({ ...LIST, tripNote: undefined });

    const sent = request();

    expect('tripNote' in sent.request.body).toBeFalse();
    sent.flush({ suggestions: [] });
  }));

  it('should resolve to the suggestions on success', fakeAsync(() => {
    const call = suggest();
    const suggestions = [{ name: 'Ski gloves', section: 'Clothes', reason: 'Cold hands.' }];

    request().flush({ suggestions });

    expect(call.outcome()).toEqual({ kind: 'ok', suggestions });
  }));

  /* No suggestions is a result, not a failure. */
  it('should resolve to an empty success when nothing is missing', fakeAsync(() => {
    const call = suggest();

    request().flush({ suggestions: [] });

    expect(call.outcome()).toEqual({ kind: 'ok', suggestions: [] });
  }));

  it('should treat a response without a suggestions field as empty', fakeAsync(() => {
    const call = suggest();

    request().flush({});

    expect(call.outcome()).toEqual({ kind: 'ok', suggestions: [] });
  }));

  it('should resolve to the quota outcome on 429', fakeAsync(() => {
    const call = suggest();

    request().flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect(call.outcome()).toEqual({ kind: 'quota' });
  }));

  /*
    Every other failure is one message to the user, so it is one outcome here —
    and an outcome rather than an error, which is what lets the dialog's spinner
    always stop.
   */
  it('should resolve to the error outcome on a service failure', fakeAsync(() => {
    const call = suggest();

    request().flush(null, { status: 502, statusText: 'Bad Gateway' });

    expect(call.outcome()).toEqual({ kind: 'error' });
  }));

  it('should resolve to the error outcome on a network failure', fakeAsync(() => {
    const call = suggest();

    request().error(new ProgressEvent('error'));

    expect(call.outcome()).toEqual({ kind: 'error' });
  }));

  it('should resolve to the error outcome when the request times out', fakeAsync(() => {
    const call = suggest();
    const pending = request();

    tick(RECOMMENDER_TIMEOUT_MS);

    expect(pending.cancelled).toBeTrue();
    expect(call.outcome()).toEqual({ kind: 'error' });
  }));

  it('should resolve to the error outcome when the token cannot be fetched', fakeAsync(() => {
    user$.next({ uid: 'uid1', getIdToken: () => Promise.reject(new Error('expired')) });

    const call = suggest();

    http.expectNone(ENDPOINT);
    expect(call.outcome()).toEqual({ kind: 'error' });
  }));

  /* The user is already on their way to /login; nothing is sent. */
  it('should send nothing while signed out', fakeAsync(() => {
    user$.next(null);

    const call = suggest();

    http.expectNone(ENDPOINT);
    expect(call.outcome()).toEqual({ kind: 'signed-out' });
  }));

  /*
    The take(1) rule in CLAUDE.md: a request left subscribed to user$ would be
    re-sent — and charged to the quota — under whoever signs in next.
   */
  it('should send once even when the auth user changes afterwards', fakeAsync(() => {
    suggest();
    user$.next(signedInAs('uid2', 'token-2'));
    flushMicrotasks();

    const sent = http.match(ENDPOINT);
    expect(sent.length).toBe(1);
    expect(sent[0].request.headers.get('Authorization')).toBe('Bearer token-1');
    sent[0].flush({ suggestions: [] });
  }));
});
