export const environment = {
  production: false,
  /*
    The item recommender (F12) run locally, on its `local` Spring profile — the
    one that allows this dev server's origin. Production points at Cloud Run
    instead; see environment.prod.ts.
   */
  recommenderUrl: 'http://localhost:8080',
  firebase: {
    apiKey: 'AIzaSyAO5g0mlYLZ2lU7Rxgxen9sbhKudZPiL4Y',
    authDomain: 'ready4trip-5d3f6.firebaseapp.com',
    databaseURL:
      'https://ready4trip-5d3f6-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'ready4trip-5d3f6',
    appId: '324402628395',
  },
};
