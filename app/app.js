// Copyright (c) 2016 OpenNot.es
"use strict";

var OpenNotes = {
	init: function() {
		if (!window.crypto || !window.crypto.subtle) {
			OpenNotes.handling.error("Your current browser does not support the Web Cryptography API. OpenNotes requires this technology to work.");
			return;
		}
		if (!window.indexedDB) {
			OpenNotes.handling.error("Your current browser does not support IndexedDB. OpenNotes requires this technology to work.");
			return;
		}
		OpenNotes.keystore.open().then(function() {
			OpenNotes.getKeyListing(OpenNotes.keystore);
		});
		$("#create-key").click(function() {
			OpenNotes.createAuthKey();
		});
	},
	createAuthKey: function() {
		var algorithmName = "RSA-OAEP";
		var usages = ["encrypt", "decrypt"];
		window.crypto.subtle.generateKey({
			name: algorithmName,
			modulusLength: 4096,
			publicExponent: new Uint8Array([1,0,1]),
			hash: {name: "SHA-256"}
		},
		false,
		usages
		).then(function(keyPair) {
			return OpenNotes.keystore.saveKey(keyPair.publicKey, keyPair.privateKey, OpenNotes.generateUUID())
		}).then(OpenNotes.addToKeyList).catch(function(err) {
			OpenNotes.handler.error("Could not create and save new key pair: " + err.message);
		});
	},
	generateUUID: function() {
		var d = new Date().getTime();
		if(window.performance && typeof window.performance.now === "function"){
        	d += performance.now(); //use high-precision timer if available
        }
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        	var r = (d + Math.random()*16)%16 | 0;
        	d = Math.floor(d/16);
        	return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    },
    escapeHtml: function(s) {
    	return s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    },
    getKeyListing: function(k) {
    	console.log(k.listKeys());
    	k.listKeys().then(function(list) {
    		for(var i = 0; i < list.length; i++) {
    			OpenNotes.addToKeyList(list[i].value);
    		}
    	}).catch(function(err) {
    		OpenNotes.handling.error("Could not get a list of keys: " + err.messsage);
    	});
    },
    addToKeyList: function(savedObject) {
    	var dataURL = OpenNotes.createDataUrl(new Uint8Array(savedObject.spki));
    	var name = OpenNotes.escapeHtml(savedObject.name);
    	$("#key-list").prepend('<li><a download="' + name + '.publicKey" href="' + dataURL + '">' + name + '</a></li>');
    },
    createDataUrl: function(byteArray) {
    	var binaryString = '';
    		for (var i = 0; i < byteArray.byteLength; i++) {
    			binaryString += String.fromCharCode(byteArray[i]);
    		}
    		return "data:application/octet-stream;base64," + btoa(binaryString);
    },
    handling: {
    	error: function(error) {
    		alert(error);
    	}
    },
    keystore: {
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
				console.log(OpenNotes.keystore.db);
				if(!OpenNotes.keystore.db.objectStoreNames.contains(OpenNotes.keystore.objectStoreName)) {
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
    		return new Promise(function(fulfill, reject) {
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