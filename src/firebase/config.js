import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyATvsgeJE6i7Q6vcXEd4Lo5fxZwASQNqsY",
  authDomain: "noble-cut.firebaseapp.com",
  projectId: "noble-cut",
  storageBucket: "noble-cut.appspot.com", // important correction!
  messagingSenderId: "823877688810",
  appId: "1:823877688810:web:f7e593e705d6d1214b6693",
  measurementId: "G-EH42WPSBJE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
