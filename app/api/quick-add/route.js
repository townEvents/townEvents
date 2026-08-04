import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

const CATEGORIES = ["Music", "Market", "Kids & Family", "Meeting / Civic", "Sports & Rec", "Arts & Culture", "Other"];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { passcode, title, description, date, time, town, location, category } = body;

  if (!process.env.QUICK_ADD_SECRET || passcode !== process.env.QUICK_ADD_SECRET) {
    return Response.json({ error: "Wrong passcode" }, { status: 401 });
  }

  if (!title || !date || !town) {
    return Response.json({ error: "Title, date, and town are required" }, { status: 400 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin.from("events").insert({
    title: title.trim(),
    description: (description || "").trim(),
    date,
    time: (time || "").trim(),
    town: town.trim(),
    location: (location || "").trim(),
    category: CATEGORIES.includes(category) ? category : "Other",
    status: "approved",
    source: "manual",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
