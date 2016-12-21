// Copyright (c) 2016 OpenNot.es
"use strict";
var OpenNotes = OpenNotes || {};

OpenNotes = {
	keystore = {
	db: null,
	dbName: "OpenNotesOpenNotes.keystore",
	objectStoreName: "Keys",
	open: function() {
		return new Promise(function(fulfill, reject){
			var req = indexedDB.open(OpenNotes.keystore.dbName, 1);
			req.onsuccess = function(evt) {
				OpenNotes.keystore.db = evt.target.result;
				fulfill(self);
			};
			req.onfailure = function(evt) {
				// deal with error in evt.error
			};
			req.onblocked = function(evt) {
				// create error describing problem
				reject(new Error("Database already open"));
			};
			req.onupgradeneeded = function(evt) {
				OpenNotes.keystore.db = evt.target.result;
				if(!OpenNotes.keystore.db.objectStoreName.contains(OpenNotes.keystore.objectStoreName)) {
					var objectStore = OpenNotes.keystore.db.createObjectStore(OpenNotes.keystore.objectStoreName, {autoIncrement: true});
					objectStore.createIndex("name", "name", {unique: false});
					objectStore.createIndex("spki", "spki", {unique: false});
				}
			};
			req.onerror = function(evt) {
				reject(evt.error);
			};

		});
	},
	close: function() {
		return new Promise(function(fulfill, reject) {
			OpenNotes.keystore.db.close();
			OpenNotes.keystore.db = null;
			fulfill();
		});
	},
	saveKey: function(publicKey, privateKey, name) {
		return new Promise(function(fulfill, reject) {
			if(!OpenNotes.keystore.db) {
				OpenNotes.keystore.open();
			}
			window.crypto.subtle.exportKey('spki', publicKey).then(function(spki) {
				var savedObject = {
					publicKey: publicKey,
					privateKey: privateKey, 
					name: name, 
					spki: spki
				};
				var transaction = OpenNotes.keystore.db.transaction([OpenNotes.keystore.objectStoreName], "readwrite");
				transaction.onerror = function(evt) {
					reject(evt.error);
				};
				transaction.onabort = function(evt) {
					reject(evt.error);
				};
				transaction.oncomplete = function(evt) {
					fulfill(savedObject);
				};
				var objectStore = transaction.objectStore(OpenNotes.keystore.objectStoreName);
				var request = objectStore.add(savedObject);
			}).catch(function(err) {
				reject(err);
			});
		});
	},
	getKey: function(propertyName, propertyValue) {
		return new Promise(function(fulfill, reject) {
			if(!OpenNotes.keystore.db) {
				OpenNotes.keystore.open();
			}
			var transaction = OpenNotes.keystore.db.transasction([OpenNotes.keystore.objectStoreName], "readonly");
			var objectStore = transaction.objectStore(OpenNotes.keystore.objectStoreName);
			var request;
			switch(propertyName) {
				case "id":
				request = objectStore.get(propertyValue); 
				break;
				case "name":
				request = objectStore.index("name").get(propertyValue);
				break;
				case "spki":
				request = objectStore.index("spki").get(propertyValue);
				break;
				default:
				reject(new Error("No such property: " + propertyName));
			}
			request.onsuccess = function(evt) {
				fulfill(evt.target.result);
			};
			request.onerror = function(evt) {
				reject(evt.error);
			};
		});
	},
	listKeys: function() {
		return new Promise(function(fullfill, reject) {
			if(!OpenNotes.keystore.db) {
				OpenNotes.keystore.open();
			}
			var list = [];
			var transaction = OpenNotes.keystore.db.transaction([OpenNotes.keystore.objectStoreName], "readonly");
			transaction.onerror = function(evt) {
				reject(evt.error);
			};
			transaction.onabort = function(evt) {
				reject(evt.error);
			};
			var objectStore = transaction.objectStore(OpenNotes.keystore.objectStoreName);
			var cursor = objectStore.openCursor();
			cursor.onsuccess = function(evt) {
				if(evt.target.result) {
					list.push({id: evt.target.result.key, value: evt.target.result.value});
					evt.target.result.continue();
				} else {
					fulfill(list);
				}
			}
		});
	}
}
};
