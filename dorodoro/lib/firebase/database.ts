import { getDatabase, type Database } from "firebase/database";

import { getFirebaseApp } from "@/lib/firebase/client";

export function getFirebaseDatabase(): Database {
  return getDatabase(getFirebaseApp());
}
