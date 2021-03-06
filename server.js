// load .env data into process.env
require("dotenv").config();

// Web server config
const PORT = process.env.PORT || 8080;
const sassMiddleware = require("./lib/sass-middleware");
const express = require("express");
const app = express();
const morgan = require("morgan");
const cookieSession = require("cookie-session");

// PG database client/connection setup
const { Pool } = require("pg");
const dbParams = require("./lib/db.js");
const db = new Pool(dbParams);
db.connect();

// Load the logger first so all (static) HTTP requests are logged to STDOUT
// 'dev' = Concise output colored by response status for development use.
//         The :status token will be colored red for server error codes, yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
app.use(morgan("dev"));

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.use(
  "/styles",
  sassMiddleware({
    source: __dirname + "/styles",
    destination: __dirname + "/public/styles",
    isSass: false, // false => scss, true => sass
  })
);
app.use(cookieSession({
  name: 'session',
  keys: ['abc'],
}))

app.use(express.static("public"));

// Separated Routes for each Resource
// Note: Feel free to replace the example routes below with your own
const usersRoutes = require("./routes/users");
const listingRoutes = require("./routes/listing");
const searchListings = require("./routes/search-listing")
const { getAllListings } = require("./server/database/getListings");
const getUserWithEmail = require("./server/database/loginFunctions");
const { getWishListings } = require("./server/database/getWishListings");
const loginRoute = require("./routes/login");
const { user } = require("pg/lib/defaults");
const req = require("express/lib/request");
const addLikes = require("./routes/likes");
const { getUserFromSession } = require("./server/getUserFromSession");

// Mount all resource routes
// Note: Feel free to replace the example routes below with your own
app.use("/api/users", usersRoutes(db));
app.use("/api/listings", listingRoutes(db));
app.use("/api/search-listings",searchListings(db));
app.use("/api/login", loginRoute(db));
app.use("/api/likes",addLikes(db));
// Note: mount other resources here, using the same pattern above

// Home page
// Warning: avoid creating more routes in this file!
// Separate them into separate routes files (see above).

app.get("/", (req, res) => {
  const data = { user : getUserFromSession(req.session) };
  console.log(data);
  const promise1 =   getAllListings(db, { order_by: 'most_liked' }, 3).then(result => {
    data.trending = result;
  })
  const promise2 =   getAllListings(db, {}).then(result => {
    data.listings = result;
  });

  Promise.all([promise1,promise2])
  .then(() => {
    res.render("index", data );
  })
});

// Rendering the new-listing form
app.get("/new-listing", (req, res) => {
  const user = getUserFromSession(req.session);

  if (!user) {
    res.redirect('/login');
    return;
  }
  res.render("create-listing", { user: user });
});

// Rendering my listings
app.get("/my-listings", (req, res) => {
  const user = getUserFromSession(req.session);

  if (!user) {
    res.redirect('/login');
    return;
  }

  getAllListings(db, { user_id: user.user_id }).then(result => {
    res.render("my-listings", { listings: result, sold: false, user: user });
  })
});

app.get("/sold-listings", (req, res) => {

  const user = getUserFromSession(req.session);

  if (!user) {
    res.redirect('/login');
    return;
  }

  getAllListings(db, { user_id: user.user_id, only_show_sold: true }).then(result => {
    res.render("my-listings", { listings: result, sold: true, user: user });
  })
});

// Rendering the search form
app.get("/search", (req, res) => {
  const user = getUserFromSession(req.session);

  if (!user) {
    res.redirect('/login');
    return;
  }
  res.render("search-form", { user: user });
});

// Login Form
app.get('/login', (req, res) => {
  const user = getUserFromSession(req.session);

  if (user) {
    res.redirect('/');
    return;
  }
   res.render("login-form", { user : {} });
});


app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});


// Rendering WishList page
app.get("/my-wishlist", (req, res) => {
  const user = getUserFromSession(req.session);

  if (!user) {
    res.redirect('/login');
    return;
  }

  getWishListings(db,{user_id: user.user_id}).then(result => {
    res.render("wish-listings",{ listings: result,sold: false, user: user });
  })
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
