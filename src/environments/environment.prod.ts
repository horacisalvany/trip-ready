export const environment = {
  production: true,
  /*
    The item recommender (F12) on Cloud Run, whose `prod` profile allows only
    the Firebase Hosting origin. Swapped in for environment.ts by the production
    build's fileReplacements in angular.json.
   */
  recommenderUrl: 'https://recommender-service-324402628395.europe-west1.run.app',
  firebase: {
    apiKey: 'AIzaSyAO5g0mlYLZ2lU7Rxgxen9sbhKudZPiL4Y',
    authDomain: 'ready4trip-5d3f6.firebaseapp.com',
    databaseURL:
      'https://ready4trip-5d3f6-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'ready4trip-5d3f6',
    appId: '324402628395',
  },
};
