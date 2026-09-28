BEAUTYBOOK FIREBASE PWA

Everything is inside this ONE folder.

1. Open js/firebase-config.js.
2. Firebase Console -> Project settings -> Your apps -> BeautyBook Web.
3. Copy your Firebase web config values into that file.
4. Keep the existing projectId: beautybook-87b3f.
5. Do NOT put service-account/private-key JSON in this project.
6. The current Firestore Production rules intentionally block client access.
7. We should add secure rules next before testing real bookings.
8. Host with Firebase Hosting over HTTPS for iPhone PWA installation.

The UI includes client booking and an owner login/dashboard.
Services are read from Firestore.
Client requests go to bookingRequests.
Owner acceptance creates a booking in bookings.
