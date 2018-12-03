var express = require('express');
var app = express();
var http = require('http');
var url  = require('url');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var mongourl = 'mongodb://comps381f:mongodb12345@ds149682.mlab.com:49682/s1196436';
var bodyParser = require("body-parser");
var session = require('cookie-session');
var fs = require('fs');
var formidable = require('formidable');


app.set('view engine', 'ejs');


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
	userID: null,
	keys: ['key1','key2']
}));


//check user is login
app.get("/", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		res.redirect('/restaurant/display/all');
	}
});


//link to userlogin.ejs
app.get("/user/login", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (isUserLoggedIn(req)){
		res.redirect('/restaurant/display/all');
	} else {
		var info = "You must login first.";
		var userID = "";
		console.log(info);
		res.render("userLogin", {info: info, userID: userID});
		console.log("-----\n");
	}
});


//handle userlogin.ejs form
app.post('/user/login/submit',function(req,res) {
	console.log('Incoming request: %s', req.path);
	var info = "";
	var userID = req.body.userID;
	var password = req.body.password;
	var userLoginSuccess = false;
	MongoClient.connect(mongourl,function(err,db) {
		try {
			assert.equal(err,null);
		} catch (err) {
			res.writeHead(500,{"Content-Type":"text/plain"});
			res.end("MongoClient connect() failed!");
		}
		var criteria = {};
		criteria['userID'] = req.body.userID;
		selectUsers(db,criteria,function(users) {
			for (var i = 0; i < users.length; i++) {
				if (users[i].userID == userID && users[i].password == password){
					userLoginSuccess = true;
				}
			}
			if (userLoginSuccess){
				req.session.userID = userID;
				console.log("req.session.userID: " + req.session.userID);
				res.redirect('/restaurant/display/all');
			} else {
				info = "UserID or password is incorrect";
				res.render("userLogin", {info: info, userID: userID});
				console.log("-----\n");
			}
		});
	});
});


//link to userCreate.ejs
app.get("/user/create", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (isUserLoggedIn(req)){
		res.redirect('/restaurant/display/all');
	} else {
		var info = "Write down information below.";
		var userID = "";
		console.log(info);
		res.render("userCreate", {info: info, userID: userID});
		console.log("-----\n");
	}
});


//handle userCreate.ejs form
app.post("/user/create", function(req,res) {
	console.log('Incoming request: %s', req.path);
	var info = "";
	var userID = req.body.userID;
	var password = req.body.password;
	var reTypePassword = req.body.reTypePassword;
	console.log("userID: " + userID + ", password: " + password + ", reTypePassword: " + reTypePassword);
	
	if (password != reTypePassword) {
		info = "Those passwords do not match.";
		console.log(info);
		res.render("userCreate", {info: info, userID: userID});
		console.log("-----\n");
	} else {
		var userIDExisted = false;
		MongoClient.connect(mongourl,function(err,db) {
			try {
				assert.equal(err,null);
			} catch (err) {
				res.writeHead(500,{"Content-Type":"text/plain"});
				res.end("MongoClient connect() failed!");
			}
			var criteria = {};
    		criteria['userID'] = userID;
			selectUsers(db,criteria,function(users) {
				for (var i = 0; i < users.length; i++) {
					if (users[i].userID == userID){
						userIDExisted = true;
					}
				}
				db.close();
				if (userIDExisted == true){
					info = "The userID exist alreadly, please use another userID.";
					console.log(info);
					res.render("userCreate", {info: info, userID: userID});
					console.log("-----\n");
				} else {
					MongoClient.connect(mongourl,function(err,db) {
					try {
						assert.equal(err,null);
					} catch (err) {
						res.writeHead(500,{"Content-Type":"text/plain"});
						res.end("MongoClient connect() failed!");
					}
					var new_r = {};
					new_r['userID'] = userID;
					new_r['password'] = password;
					insertUsers(db,new_r,function(result) {
						db.close();
						info = "User registration successful. Please login.";
						console.log(info);
						res.render("userCreateSuccessful", {info: info});
						console.log("-----\n");
						});
			        });
				}
			});
		});
	}
});


//handle logout
app.get("/user/logout", function(req,res) {
	console.log('Incoming request: %s', req.path);
	var userID = req.session.userID = null;
	console.log("req.session.userID: " + userID);
	res.redirect("/");
});


//link to restaurantDisplayAll.ejs
app.get("/restaurant/display/all", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
			console.log("Database connected!");
			var criteria = {};
			selectRestaurants(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB');
				var userID = req.session.userID;
				res.render("restaurantDisplayAll", {restaurants: restaurants, userID: userID});
				console.log("-----\n");
			});
		});
	}
});


//link to restaurantCreate.ejs
app.get("/restaurant/create", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		var owner = req.session.userID;
		res.render("restaurantCreate", {owner: owner});
		console.log("-----\n");
	}
});


//handle restaurantCreate.ejs form
app.post("/restaurant/create/submit", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		var form = new formidable.IncomingForm();
    	form.parse(req, function (err, fields, files) {
    	var filename = files.photo.path;
      //console.log(JSON.stringify(files));
      var mimetype = files.photo.type;
      fs.readFile(filename, function(err,data) {
        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          var new_r = {};
          new_r['restaurantID'] = new Date().getTime().toString();
	        new_r['name'] = fields.name;
	          new_r['borough'] = fields.borough;
	           new_r['cuisine'] = fields.cuisine;
          new_r['photo'] = new Buffer(data).toString('base64');
			       new_r['photoMimetype'] = mimetype;
          var address = {};
			address['street'] = fields.street;
			address['building'] = fields.building;
			address['zipcode'] = fields.zipcode;
			address['coord'] = [fields.coord_lon, fields.coord_lat];
			new_r['address'] = address;
			new_r['grades'] = [];
			new_r['owner'] = fields.owner;
      insertRestaurants(db,new_r,function(result) {
    db.close();
    console.log('Disconnected MongoDB');
    MongoClient.connect(mongourl, function(err, db) {
      if (err) throw err;
      console.log("Database connected!");
      var criteria = {};
      selectRestaurants(db,criteria,function(restaurants) {
        db.close();
        console.log('Disconnected MongoDB');
        res.redirect("/restaurant/display/details?restaurantID=" + new_r['restaurantID']);
      });
    });
  });
        });
      })
    });
	}
});


//link to restaurantDisplayDetails.ejs
app.get("/restaurant/display/details", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		var restaurantID = req.query.restaurantID;
		if (restaurantID == null){
			res.redirect('/restaurant/display/all');
		} else {
			MongoClient.connect(mongourl, function(err, db) {
			  if (err) throw err;
			  	console.log("Database connected!");
				var criteria = {};
				criteria['restaurantID'] = restaurantID;
				selectRestaurants(db,criteria,function(restaurants) {
					db.close();
					console.log('Disconnected MongoDB');
					var userID = req.session.userID;
					if (JSON.stringify(restaurants) === "[]") {
						res.redirect('/restaurant/display/all');
					} else {
						res.render("restaurantDisplayDetails", {restaurants: restaurants, userID: userID});
						console.log("-----\n");
					}
				});
			});
		}
	}
});


//link to restaurantUpdate.ejs
app.get("/restaurant/update", function(req,res) {
	console.log('Incoming request: %s', req.path);
	var restaurantID = req.query.restaurantID;
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else if (restaurantID == null){
		res.redirect('/restaurant/display/all');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
		  	console.log("Database connected!");
			var criteria = {};
			criteria['restaurantID'] = restaurantID;
			selectRestaurants(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB');
				if (JSON.stringify(restaurants) === "[]") {
					res.redirect('/restaurant/display/all');
				} else {
					var userID = req.session.userID;
					var owner = restaurants[0].owner;
					if (userID == owner){
						res.render("restaurantUpdate", {restaurants: restaurants});
						console.log("-----\n");
					} else {
						res.redirect('/restaurant/display/details/?restaurantID=' + restaurantID)
					}
				}
			});
		});
	}
});


//handle restaurantUpdate.ejs form
app.post("/restaurant/update/submit", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
	var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
    	var filename = files.photo.path;
      //console.log(JSON.stringify(files));
      var photoSize = files.photo.size;
      var mimetype = files.photo.type;
      fs.readFile(filename, function(err,data) {
        MongoClient.connect(mongourl,function(err,db) {
          try {
            assert.equal(err,null);
          } catch (err) {
            res.writeHead(500,{"Content-Type":"text/plain"});
            res.end("MongoClient connect() failed!");
          }
          var new_r = {};
          new_r['restaurantID'] = fields.restaurantID;
	        new_r['name'] = fields.name;
	          new_r['borough'] = fields.borough;
	           new_r['cuisine'] = fields.cuisine;
	           if (photoSize > 0){
	        	new_r['photo'] = new Buffer(data).toString('base64');
	           }
          
			       new_r['photoMimetype'] = mimetype;
          var address = {};
			address['street'] = fields.street;
			address['building'] = fields.building;
			address['zipcode'] = fields.zipcode;
			address['coord'] = [fields.coord_lon, fields.coord_lat];
			new_r['address'] = address;
			new_r['grades'] = [];
			new_r['owner'] = fields.owner;
			var userID = req.session.userID;
			var owner = fields.owner;
			if (userID == owner){
				 MongoClient.connect(mongourl, function(err, db) {
			      if (err) throw err;
			      console.log("Database connected!");
			      var criteria = {};
			      criteria['restaurantID'] = fields.restaurantID;
			      updateRestaurantSet(db,criteria, new_r,function(result) {
					db.close();
					console.log('Disconnected MongoDB');
					res.redirect("restaurant/display/details?restaurantID=" + fields.restaurantID);
				});
    		});
				console.log("-----\n");
			} else {
				res.redirect('/restaurant/display/details/?restaurantID=' + restaurantID)
			}
        });
      })
    });
	}
});


//link to restaurantRate.ejs
app.get("/restaurant/rate", function(req,res) {
	console.log('Incoming request: %s', req.path);
	var restaurantID = req.query.restaurantID;
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else if (restaurantID == null){
		res.redirect('/restaurant/display/all');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
		  	console.log("Database connected!");
			var criteria = {};
			criteria['restaurantID'] = restaurantID;
			selectRestaurants(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB');
				if (JSON.stringify(restaurants) === "[]") {
					res.redirect('/restaurant/display/all');
				} else {
					res.render("restaurantRate", {restaurants: restaurants});
					console.log("-----\n");
				}
			});
		});
	}
});


//handle restaurantRate.ejs form
app.get("/restaurant/rate/submit", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		var restaurantID = req.query.restaurantID;
		if (restaurantID == null){
			res.redirect('/restaurant/display/all');
		} else {
			MongoClient.connect(mongourl,function(err,db) {
				try {
					assert.equal(err,null);
				} catch (err) {
					res.writeHead(500,{"Content-Type":"text/plain"});
					res.end("MongoClient connect() failed!");
				}
				var grades = {};
				grades["user"] = req.session.userID;
				grades["score"] = req.query.score;
				var new_r = {};
				new_r["grades"] = grades;
				var criteria = {};
				var restaurantID = req.query.restaurantID;
				criteria['restaurantID'] = restaurantID;
				updateRestaurantPush(db,criteria, new_r,function(result) {
					db.close();
					console.log('Disconnected MongoDB');
					res.redirect("restaurant/display/details?restaurantID=" + req.query.restaurantID);
				});
			});
		}
	}
});


//link to restaurantDelete.ejs
app.get("/restaurant/delete", function(req,res) {
	console.log('Incoming request: %s', req.path);
	var restaurantID = req.query.restaurantID;
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else if (restaurantID == null){
		res.redirect('/restaurant/display/all');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
		  	console.log("Database connected!");
			var criteria = {};
			criteria['restaurantID'] = restaurantID;
			selectRestaurants(db,criteria,function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB');
				if (JSON.stringify(restaurants) === "[]") {
					res.redirect('/restaurant/display/all');
				} else {
					var userID = req.session.userID;
					var owner = restaurants[0].owner;
					if (userID == owner){
						res.render("restaurantDelete", {restaurants: restaurants});
						console.log("-----\n");
					} else {
						res.redirect("restaurant/display/details?restaurantID=" + req.query.restaurantID);
					}
				}
			});
		});
	}
});


//handle restaurantDelete.ejs form
app.get("/restaurant/delete/submit", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		var restaurantID = req.query.restaurantID;
		if (restaurantID == null){
			res.redirect('/restaurant/display/all');
		} else {
			MongoClient.connect(mongourl, function(err, db) {
				if (err) throw err;
			  	console.log("Database connected!");
				var criteria = {};
				criteria['restaurantID'] = restaurantID;
				deleteRestaurant(db,criteria,function(restaurants) {
					db.close();
					console.log('Disconnected MongoDB');
					res.redirect("/restaurant/display/all");
				});
			});
		}
	}
});


//link to restaurantSearch.ejs
app.get("/restaurant/search", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		MongoClient.connect(mongourl, function(err, db) {
			if (err) throw err;
		  	console.log("Database connected!");
		  	var column = req.query.column;
		  	var keyword = req.query.keyword;
			var criteria = {};
			criteria[column] = { $in: [ new RegExp(keyword, "g") ] };
			selectRestaurants(db,criteria, function(restaurants) {
				db.close();
				console.log('Disconnected MongoDB');
				res.render("restaurantSearch", {restaurants: restaurants, column: column, keyword: keyword});
				console.log("-----\n");
			});
		});
	}
});


//link to restaurantDisplayMap.ejs
app.get("/restaurant/display/map", function(req,res) {
	console.log('Incoming request: %s', req.path);
	if (!isUserLoggedIn(req)){
		res.redirect('/user/login');
	} else {
		res.render("restaurantDisplayMap", {
		restaurantID:req.query.restaurantID,
		lat:req.query.lat,
		lon:req.query.lon,
		zoom:15
		});
		console.log("-----\n");
	}
});


//handle RESTful service
app.get('/api/restaurant/name/:keyword',function(req,res){
	console.log('Incoming request: %s', req.path);
    var keyword = req.params.keyword;
    //console.log(keyword);
    MongoClient.connect(mongourl, function(err, db) {
		if (err) throw err;
	  	console.log("Database connected!");
		var criteria = {};
		criteria['name'] = { $in: [  new RegExp(keyword, "g") ] };
		selectRestaurants(db,criteria, function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB');
			if(JSON.stringify(restaurants) === "[]"){
				res.write("{}");
				res.end();
			} else {
				res.status(200).json(restaurants).end();
			}
			console.log("-----\n");
		});
	});
});


app.get('/api/restaurant/borough/:keyword',function(req,res){
	console.log('Incoming request: %s', req.path);
    var keyword = req.params.keyword;
    //console.log(keyword);
    MongoClient.connect(mongourl, function(err, db) {
		if (err) throw err;
	  	console.log("Database connected!");
		var criteria = {};
		criteria['borough'] = { $in: [  new RegExp(keyword, "g") ] };
		selectRestaurants(db,criteria, function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB');
			if(JSON.stringify(restaurants) === "[]"){
				res.write("{}");
				res.end();
			} else {
				res.status(200).json(restaurants).end();
			}
			console.log("-----\n");
		});
	});
});


app.get('/api/restaurant/cuisine/:keyword',function(req,res){
	console.log('Incoming request: %s', req.path);
    var keyword = req.params.keyword;
    //console.log(keyword);
    MongoClient.connect(mongourl, function(err, db) {
		if (err) throw err;
	  	console.log("Database connected!");
		var criteria = {};
		criteria['cuisine'] = { $in: [  new RegExp(keyword, "g") ] };;
		selectRestaurants(db,criteria, function(restaurants) {
			db.close();
			console.log('Disconnected MongoDB');
			if(JSON.stringify(restaurants) === "[]"){
				res.write("{}");
				res.end();
			} else {
				res.status(200).json(restaurants).end();
			}
			console.log("-----\n");
		});
	});
});


app.post("/api/restaurant", function (req, res) {
	console.log('Incoming request: %s', req.path);
	if (req.body.name && req.body.owner) {
		var id = new ObjectId()
		var date = new Date().getTime();
		
		var new_r = {};
		new_r["_id"] = id;
		new_r["restaurantID"] = date.toString();
		new_r['name'] = req.body.name;
		new_r["borough"] = typeof req.body.borough === 'undefined'? "" : req.body.borough;
		new_r['cuisine'] = typeof req.body.cuisine === 'undefined'? "" : req.body.cuisine;
		new_r['photo'] = typeof req.body.photo === 'undefined'? "" : req.body.photo;
		new_r['photoMimetype'] = typeof req.body.photoMimetype === 'undefined'? "" : req.body.photoMimetype;
		var address = {};
		address['street'] = typeof req.body.street === 'undefined'? "" : req.body.street;
		address['building'] = typeof req.body.building === 'undefined'? "" : req.body.building;
		address['zipcode'] = typeof req.body.zipcode === 'undefined'? "" : req.body.zipcode;
		address['coord'] = typeof req.body.coord === 'undefined'? ["", ""] : req.body.coord;
		new_r['address'] = address;
		new_r['grades'] = [];
		new_r['owner'] = req.body.owner;
		var doc = Object.assign(new_r)

		MongoClient.connect(mongourl, function (err, db) {
			if (err) throw err;
			console.log("Database connected!");
			 insertRestaurants(db,doc,function(result) {
		    	db.close();
		    	console.log('Disconnected MongoDB');
		    	res.json({status: "ok", _id: id})
		    	console.log("-----\n");
			});
		});
	} else {;
		res.json({status: "failed"})
		console.log("-----\n");
	}
})


app.get("/testing/apipost", function (req, res) {
	res.status(200)
	res.send(`
		<textarea id="input"></textarea>
		<button id="send">SEND</button>
		<script>
		document.querySelector("#send").onclick = function () {
			console.log("send POST request")
			try {
				var body = JSON.parse(document.querySelector("#input").value)
				fetch("/api/restaurant", {
					method: 'post',
					body: JSON.stringify(body),
					headers: {
                    	'Accept': 'application/json',
						'Content-Type': 'application/json'
					},
				})
				.then(function(resp) {
				    return resp.json();
				})
				.then(function(data) {
				    console.log('response', data);
				});
			} catch (e) {
				alert("NOT invalid JSON")
			}
		}
		</script>
	`)
})


//Check user is logged in
function isUserLoggedIn(req) {
	var userID = req.session.userID;
	if (userID != null){
		console.log("isUserLoggedIn(): true\nreq.session.userID: " + userID);
		return true;
	} else {
		console.log("isUserLoggedIn(): false\nreq.session.userID: " + userID);
		return false;	
	}
}


//handle user collection
function insertUsers(db,r,callback) {
  db.collection('user').insertOne(r,function(err,result) {
    assert.equal(err,null);
    console.log("insertUsers was successful!");
    callback(result);
  });
}


function selectUsers(db,criteria,callback) {
	var cursor = db.collection('user').find(criteria);
	var users = [];
	cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			users.push(doc);
		} else {
			console.log("selectUsers was successful!");
			callback(users);
		}
	});
}


//handle restaurant collection
function insertRestaurants(db,r,callback) {
  db.collection('restaurant').insertOne(r,function(err,result) {
    assert.equal(err,null);
    console.log("insertRestaurants was successful!");
    callback(result);
  });
}


function selectRestaurants(db,criteria,callback) {
	var cursor = db.collection('restaurant').find(criteria);
	var restaurants = [];
	cursor.each(function(err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			console.log("selectRestaurants was successful!");
			callback(restaurants);
		}
	});
}


/*
function selectRestaurants(db,criteria,callback) {
	db.collection('restaurant').find(criteria).toArray(function (err, data) {
		callback(data)
	})
}
*/


function updateRestaurantSet(db,criteria,newValues,callback) {
	db.collection('restaurant').updateOne(criteria,{$set: newValues},function(err,result) {
			assert.equal(err,null);
			console.log("updateRestaurantSet was successfully");
			callback(result);
	});
}


function updateRestaurantPush(db,criteria,newValues,callback) {
	db.collection('restaurant').updateOne(criteria,{$push: newValues},function(err,result) {
			assert.equal(err,null);
			console.log("updateRestaurantPush was successfully");
			callback(result);
	});
}


function deleteRestaurant(db,criteria,callback) {
	db.collection('restaurant').deleteMany(criteria,function(err,result) {
		assert.equal(err,null);
		console.log("deleteRestaurant was successfully");
		callback(result);
	});
}


app.listen(process.env.PORT || 8099);
