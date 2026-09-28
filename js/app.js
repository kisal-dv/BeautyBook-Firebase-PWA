import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  firebaseConfig
} from "./firebase-config.js";


/* =========================================================
   FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* =========================================================
   APP STATE
========================================================= */

let services = [];
let chosen = null;
let time = null;

let requests = [];
let bookings = [];

let unsubRequests = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

const icons = {
  "Hair Colouring": "🎨",
  "Hair Dressing": "💇‍♀️",
  "Hair Cutting": "✂️",
  "Hair Styling": "✨",
  "Waxing": "🌸",
  "Eyebrow Threading": "🪡",
  "Full Face Threading": "🪞",
  "Nail Art": "💅"
};


function normalizePrice(value) {

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    const lowered = trimmed.toLowerCase();

    if (lowered === "price on request" || lowered === "on request") {
      return "";
    }

    const numeric = Number(trimmed.replace(/[$,\s]/g, ""));

    return Number.isFinite(numeric) ? numeric : "";
  }

  return "";

}


function formatPrice(value) {

  const normalized = normalizePrice(value);

  if (normalized === "") {
    return "Price on request";
  }

  if (typeof normalized === "number") {
    return `$${normalized}`;
  }

  return "Price on request";

}


async function normalizeServicePrices() {

  try {

    const snapshot = await getDocs(
      collection(db, "services")
    );

    let updated = 0;

    for (const document of snapshot.docs) {

      const data = document.data();
      const currentPrice = data.price;
      const normalized = normalizePrice(currentPrice);

      if (normalized === "" && currentPrice !== "") {
        continue;
      }

      const cleanValue =
        typeof normalized === "number"
          ? normalized
          : "";

      if (currentPrice !== cleanValue) {
        await updateDoc(doc(db, "services", document.id), {
          price: cleanValue
        });

        updated += 1;
      }

    }

    toast(`Service prices normalized: ${updated}`);

    await loadServices();

  }

  catch (error) {

    console.error("SERVICE PRICE NORMALIZATION ERROR:", error);
    toast("Could not normalize service prices.");

  }

}

window.normalizeServicePrices = normalizeServicePrices;


function toast(message) {

  const element = $("toast");

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;

  element.classList.add("show");

  setTimeout(() => {
    element.classList.remove("show");
  }, 2500);
}


/* =========================================================
   THEME
========================================================= */

window.toggleTheme = () => {

  document.body.classList.toggle("dark");

};


/* =========================================================
   TABS
========================================================= */

window.tab = (name, button) => {

  $("book").classList.toggle("hidden", name !== "book");

  $("owner").classList.toggle("hidden", name !== "owner");

  document
    .querySelectorAll(".tabs button")
    .forEach(btn => btn.classList.remove("active"));

  button.classList.add("active");

};


/* =========================================================
   LOAD SERVICES
========================================================= */

async function loadServices() {

  try {

    const snapshot = await getDocs(
      collection(db, "services")
    );

    services = snapshot.docs
      .map(document => {

        const data = document.data();

        return {
          id: document.id,
          name: data.name || "",
          price: normalizePrice(data.price),
          duration: data.duration,
          active: data.active
        };

      })
      .filter(service => {

        return service.active !== false &&
               service.name.trim() !== "";

      });

    console.log("Loaded services:", services);

  }

  catch (error) {

    console.error("Services loading error:", error);

    services = [];

    toast("Could not load services.");

  }

  renderServices();

}


/* =========================================================
   RENDER SERVICES
========================================================= */

function renderServices() {

  const servicesElement = $("services");

  if (!servicesElement) {
    return;
  }


  if (services.length === 0) {

    servicesElement.innerHTML =
      "<small>No services available.</small>";

    renderSlots();

    return;

  }


  servicesElement.innerHTML = services
    .map(service => {

      const icon =
        icons[service.name] || "✦";

      const price = formatPrice(service.price);


      return `
        <button
          class="service ${chosen?.id === service.id ? "sel" : ""}"
          onclick="choose('${service.id}')">

          ${icon}

          <b>${service.name}</b>

          <small>${price}</small>

        </button>
      `;

    })
    .join("");


  renderSlots();

}


/* =========================================================
   CHOOSE SERVICE
========================================================= */

window.choose = id => {

  chosen = services.find(
    service => service.id === id
  );

  time = null;

  renderServices();

};


/* =========================================================
   DATE
========================================================= */

const dateElement = $("date");

if (dateElement) {

  dateElement.value =
    new Date().toISOString().slice(0, 10);

  dateElement.addEventListener(
    "change",
    async () => {

      time = null;

      await loadConfirmedBookings();

    }
  );

}


/* =========================================================
   AVAILABLE TIME SLOTS
========================================================= */

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00"
];


function renderSlots() {

  const slotsElement = $("slots");

  if (!slotsElement) {
    return;
  }


  slotsElement.innerHTML =
    TIME_SLOTS
      .map(slot => {

        const booked =
          bookings.some(
            booking =>
              booking.time === slot &&
              booking.status === "confirmed"
          );


        const selected =
          time === slot;


        if (booked) {

          return `
            <button
              class="slot booked"
              disabled>
              ${slot} · Booked
            </button>
          `;

        }


        return `
          <button
            class="slot ${selected ? "sel" : ""}"
            onclick="pick('${slot}')">
            ${slot}
          </button>
        `;

      })
      .join("");

}


/* =========================================================
   PICK TIME
========================================================= */

window.pick = slot => {

  const alreadyBooked =
    bookings.some(
      booking =>
        booking.time === slot &&
        booking.status === "confirmed"
    );


  if (alreadyBooked) {

    toast("That time is already booked.");

    return;

  }


  time = slot;

  renderSlots();

};


/* =========================================================
   LOAD CONFIRMED BOOKINGS FOR SELECTED DATE
========================================================= */

async function loadConfirmedBookings() {

  const selectedDate =
    $("date")?.value;


  if (!selectedDate) {

    bookings = [];

    renderSlots();

    return;

  }


  try {

    const bookingQuery = query(
      collection(db, "bookings"),
      where("date", "==", selectedDate),
      where("status", "==", "confirmed")
    );


    const snapshot =
      await getDocs(bookingQuery);


    bookings = snapshot.docs.map(document => {

      return {
        id: document.id,
        ...document.data()
      };

    });


    console.log(
      "Confirmed bookings:",
      bookings
    );


  }

  catch (error) {

    console.error(
      "Could not load confirmed bookings:",
      error
    );

    /*
      Do NOT remove the time buttons if the query fails.
      The customer can still see the available slots.
    */

    bookings = [];

  }


  renderSlots();

}


/* =========================================================
   CUSTOMER BOOKING REQUEST
========================================================= */

window.requestBooking = async () => {

  if (!chosen) {

    toast("Choose a service.");

    return;

  }


  if (!time) {

    toast("Choose a time.");

    return;

  }


  const name =
    $("name")?.value.trim() || "";

  const phone =
    $("phone")?.value.trim() || "";

  const notes =
    $("notes")?.value.trim() || "";

  const selectedDate =
    $("date")?.value || "";


  if (!name || !phone) {

    toast("Enter your name and phone.");

    return;

  }


  if (!selectedDate) {

    toast("Choose a date.");

    return;

  }


  try {

    /*
      Check again immediately before creating
      the request.
    */

    const bookingQuery = query(
      collection(db, "bookings"),
      where("date", "==", selectedDate),
      where("time", "==", time),
      where("status", "==", "confirmed")
    );


    const existingBookings =
      await getDocs(bookingQuery);


    if (!existingBookings.empty) {

      toast(
        "Sorry, that time is already booked."
      );

      await loadConfirmedBookings();

      return;

    }


    /*
      Create booking request.
    */

    await addDoc(
      collection(db, "bookingRequests"),
      {

        clientName: name,

        phone: phone,

        serviceId: chosen.id,

        serviceName: chosen.name,

        requestedDate: selectedDate,

        requestedTime: time,

        notes: notes,

        status: "pending",

        createdAt: serverTimestamp()

      }
    );


    toast(
      "Booking request sent ✨"
    );


    /*
      Clear customer form.
    */

    $("name").value = "";

    $("phone").value = "";

    $("notes").value = "";

    time = null;

    renderSlots();

  }

  catch (error) {

    console.error(
      "BOOKING REQUEST ERROR:",
      error
    );


    /*
      IMPORTANT:
      Show the real Firebase error.
    */

    toast(
      "Firebase error: " +
      (error.message || "Unknown error")
    );

  }

};


/* =========================================================
   OWNER LOGIN
========================================================= */

window.login = async () => {

  const email =
    $("email")?.value || "";

  const password =
    $("pass")?.value || "";


  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );


    toast("Signed in ✓");

  }

  catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    toast(
      "Login failed: " +
      (error.message || "Unknown error")
    );

  }

};


/* =========================================================
   OWNER LOGOUT
========================================================= */

window.logout = () => {

  signOut(auth);

};


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
  auth,
  user => {

    if ($("login")) {

      $("login")
        .classList
        .toggle("hidden", !!user);

    }


    if ($("dash")) {

      $("dash")
        .classList
        .toggle("hidden", !user);

    }


    if (user) {

      watchRequests();

    }

    else {

      if (unsubRequests) {

        unsubRequests();

        unsubRequests = null;

      }

    }

  }
);


/* =========================================================
   OWNER BOOKING REQUEST LISTENER
========================================================= */

function watchRequests() {

  if (unsubRequests) {

    unsubRequests();

  }


  const requestsQuery = query(
    collection(db, "bookingRequests"),
    orderBy("createdAt", "desc")
  );


  unsubRequests = onSnapshot(

    requestsQuery,

    snapshot => {

      requests =
        snapshot.docs.map(document => {

          return {
            id: document.id,
            ...document.data()
          };

        });


      showRequests();

    },

    error => {

      console.error(
        "REQUEST LISTENER ERROR:",
        error
      );

    }

  );

}


/* =========================================================
   DISPLAY OWNER REQUESTS
========================================================= */

function showRequests() {

  const pendingCount =
    requests.filter(
      request =>
        request.status === "pending"
    ).length;


  const confirmedCount =
    requests.filter(
      request =>
        request.status === "accepted"
    ).length;


  if ($("pending")) {

    $("pending").textContent =
      pendingCount;

  }


  if ($("confirmed")) {

    $("confirmed").textContent =
      confirmedCount;

  }


  if (!$("requests")) {
    return;
  }


  if (requests.length === 0) {

    $("requests").innerHTML =
      "<small>No requests.</small>";

    return;

  }


  $("requests").innerHTML =
    requests.map(request => {

      const service =
        request.serviceName ||
        "Service";


      const date =
        request.requestedDate ||
        "No date";


      const requestedTime =
        request.requestedTime ||
        "No time";


      const clientName =
        request.clientName ||
        "Customer";


      const phone =
        request.phone ||
        "No phone";


      const notes =
        request.notes || "";


      if (request.status === "pending") {

        return `
          <div class="request">

            <b>${clientName}</b>

            <small>
              ${service}
              ·
              ${date}
              ·
              ${requestedTime}
            </small>

            <small>
              📱 ${phone}
            </small>

            ${
              notes
                ? `<small>📝 ${notes}</small>`
                : ""
            }

            <div class="actions">

              <button
                class="accept"
                onclick="accept('${request.id}')">
                Accept
              </button>

              <button
                class="decline"
                onclick="decline('${request.id}')">
                Decline
              </button>

            </div>

          </div>
        `;

      }


      return `
        <div class="request">

          <b>${clientName}</b>

          <small>
            ${service}
            ·
            ${date}
            ·
            ${requestedTime}
          </small>

          <small>
            📱 ${phone}
          </small>

          ${
            notes
              ? `<small>📝 ${notes}</small>`
              : ""
          }

          <small>
            Status: ${request.status}
          </small>

        </div>
      `;

    }).join("");

}


/* =========================================================
   ACCEPT BOOKING
========================================================= */

window.accept = async id => {

  const request =
    requests.find(
      item => item.id === id
    );


  if (!request) {

    toast("Booking request not found.");

    return;

  }


  try {

    /*
      Check whether another confirmed
      appointment already occupies this time.
    */

    const bookingQuery = query(
      collection(db, "bookings"),
      where("date", "==", request.requestedDate),
      where("time", "==", request.requestedTime),
      where("status", "==", "confirmed")
    );


    const existing =
      await getDocs(bookingQuery);


    if (!existing.empty) {

      toast(
        "That time is already booked."
      );

      return;

    }


    /*
      Create confirmed booking.
    */

    await addDoc(
      collection(db, "bookings"),
      {

        clientName:
          request.clientName,

        phone:
          request.phone,

        serviceId:
          request.serviceId,

        serviceName:
          request.serviceName,

        date:
          request.requestedDate,

        time:
          request.requestedTime,

        status:
          "confirmed",

        notes:
          request.notes || "",

        createdAt:
          serverTimestamp()

      }
    );


    /*
      Change request status.
    */

    await updateDoc(
      doc(
        db,
        "bookingRequests",
        id
      ),
      {
        status: "accepted"
      }
    );


    toast(
      "Appointment accepted ✓"
    );


    await loadConfirmedBookings();

  }

  catch (error) {

    console.error(
      "ACCEPT ERROR:",
      error
    );


    toast(
      "Could not accept: " +
      (error.message || "Unknown error")
    );

  }

};


/* =========================================================
   DECLINE BOOKING
========================================================= */

window.decline = async id => {

  try {

    await updateDoc(
      doc(
        db,
        "bookingRequests",
        id
      ),
      {
        status: "declined"
      }
    );


    toast(
      "Request declined"
    );

  }

  catch (error) {

    console.error(
      "DECLINE ERROR:",
      error
    );


    toast(
      "Could not decline: " +
      (error.message || "Unknown error")
    );

  }

};


/* =========================================================
   START APP
========================================================= */

async function startApp() {

  await loadServices();

  await loadConfirmedBookings();

}


startApp();