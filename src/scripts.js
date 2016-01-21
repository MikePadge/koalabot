/*
	Copyright (C) 2016  skhmt

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation version 3.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

 // vars 
var clientid = "3y2ofy4qcsvnaybw9ogdzwmwfode8y0"; /* this is the (public) client_id of KoalaBot. */
var bot;
var server = "irc.twitch.tv";
var fs;
var logFile;
var execPath;
var hosts = [];
var hostFile;
var viewers = [];
var startDate = new Date();
var subBadgeUrl = "";
var permitted = [];
var modSettings;
var emoticonsTwitch = [];
var emoticonsBTTV = [];
var emoticonsBTTVall = [];
var followers = [];

var settings = {
	access_token: "",
	username: "",
	channel: "",
	id: ""
};


$(document).ready( function() {
	
	// Setting up jQuery elements
	var gui = require( "nw.gui" )
	var win = gui.Window.get();

	
	$("#tabs").tabs();
	
	$("#getOauthDialog").dialog( {
		autoOpen: false,
		modal: true,
		height: 580,
		width: 700	
	} );
	
	$("#graphDialog").dialog( {
		autoOpen: false,
		modal: true,
		height: 580,
		width: 750	
	} );

	$("#getOauthLink")
		.button()
		.click( function() {
			$("#getOauthDialog").dialog( "open" );
	} );

	$("#saveOauth")
		.button()
		.click( function() {
			var newoauth = $("#getOauthField").val();
			if ( settings.access_token !== newoauth ) { // if you're changing user
				settings.access_token = newoauth;
				getUsername();
			}
	} );

	$("#changeChannel")
		.button()
		.click( function() {
			var newchan = $("#getChannelField").val();
			if ( newchan.substring(0,1) !== "#" ) { // if the user forgot the #, add it
				newchan = "#"+newchan;
				$("#getChannelField").val(newchan);
			}

			if ( newchan !== settings.channel ) { // if the channel is actually different
				bot.part( settings.channel, function(){
					log( "* Parting " + settings.channel );
				} );
				bot.join( newchan, function() {
					log( "* Joining " + newchan );
					settings.channel = newchan;
					runHU();
				} );
			}
	} );
	
	// window control jQuery elements
	$("#devTools").button( {
		text: false,
		icons: {
			primary: "ui-icon-wrench"
		}
	} ).click( function(event) {
		win.showDevTools();
	} );
	$("#exit").button( {
		text: false,
		icons: {
			primary: "ui-icon-close"
		}
	} ).click( function(event) {
		win.close();
	} );
	$("#minimize").button( {
		text: false,
		icons: {
			primary: "ui-icon-minusthick"
		}
	} ).click( function(event) {
		win.minimize();
	} );
	$("#maximize").button( {
		text: false,
		icons: {
			primary: "ui-icon-arrowthick-1-ne"
		}
	} ).click( function(event) {
		var options;
		if ( $( this ).text() === "maximize" ) {
			options = {
				label: "unmaximize",
				icons: {
					primary: "ui-icon-arrowthick-1-sw"
				}
			};
			win.maximize();
		} else {
			options = {
				label: "maximize",
				icons: {
					primary: "ui-icon-arrowthick-1-ne"
				}
			};
			win.unmaximize();
		}
		$( this ).button( "option", options );
	} );

	// Setting up file read stuff and variables
	fs = require( "fs" );
	var path = require( "path" );
	
	execPath = path.dirname( process.execPath );
	
	// making logs and settings directories
	try { fs.accessSync( execPath + "\\logs" ); }
	catch (e) { fs.mkdirSync( execPath + "\\logs" ); }
	
	try { fs.accessSync( execPath + "\\settings" ); }
	catch (e) { fs.mkdirSync( execPath + "\\settings" ); }
	
	
	hostFile = execPath + "\\logs\\hosts.log";

	// Setting up the chat log
	var d = new Date();
	var dmonth = d.getMonth() + 1;
	dmonth = dmonth < 10 ? "0" + dmonth : dmonth;
	var dday = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
	var dhour = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
	var dmin = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
	var dsec = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds();
	var logname = "chatlog_" + d.getFullYear() + "-" + dmonth + "-" + dday + "_" + dhour + "-" + dmin + "-" + dsec + ".log";
	logFile = execPath + "\\logs\\" + logname;
	
	// setting up moderation area
	modSetup();
	
	// setting up the commands area
	cmdSetup();
	
	// getting twitch and bttv emoticons
	getEmoticons();
	
	// setting up timed messages
	timedMessagesSetup();
	
	// starting the timer
	timerSetup();
	
	// setting up stats stuff
	statsSetup();
	
	// setting up the raffle tab
	raffleSetup();

	// setting up songs
	songsSetup();
	
	// loading settings.ini
	try {
		var readFile = fs.readFileSync( execPath + "\\settings\\settings.ini" );
		settings = $.parseJSON( readFile );

		// Setting up config area
		$("#getOauthField").val( settings.access_token );
		$("#getChannelField").val( settings.channel );
		$("#displayName").html( settings.username );

		// Running tabs
		runChat();
		runHU();
	} catch (e) {
		$("#getOauthField").val("");
	}
});

function getUsername() {
	var token = settings.access_token.substring(6);
	$.getJSON(
		"https://api.twitch.tv/kraken",
		{
			"client_id" : clientid,
			"api_version" : 3,
			"oauth_token" : token	
		},
		function( response ) {
			settings.username = response.token.user_name;
			$("#displayName").html( settings.username );
			
			settings.channel = "#" + settings.username;
			$("#getChannelField").val( settings.channel );

			save();	
			runChat();
			runHU();
		}
	);
}


function runChat() {
	
	try {
		bot.disconnect( function() {
			log( "* Disconnected from " + server );
		});
	} catch (e) {}

	var irc = require( "irc" );
	
	var config = {
		//channels: [settings.channel],
		server: server,
		username: settings.username,
		nick: settings.username,
		password: settings.access_token,
		sasl: true,
		autoConnect: false
	};

	bot = new irc.Client( config.server, config.nick, config );

	bot.connect(5, function() {
		log( "* Connected to " + server );
	} );
	
	bot.addListener( "registered", function( message ) {
		bot.send( "CAP REQ", "twitch.tv/membership" );
		bot.send( "CAP REQ", "twitch.tv/commands" );
		bot.send( "CAP REQ", "twitch.tv/tags" )
		bot.join( settings.channel, function() {
			log( "* Joining " + settings.channel );
		} );
	} );
	
	bot.addListener( "error", function( message ) {
		log( "* Error: " + message );
	} );
	
	bot.addListener( "raw", function( message ) {
		var args = message.args[0].split(" ");
		var command = message.command;
		
		if (false){ // logging all raw commands
			log( "<b>" + message.rawCommand + "</b>" );
			log( " args: " + args );
		}
		
		parseMsg(command, args);
	} );
}

// This is run every time a channel is entered
function runHU() {

	// clearing the host file, hosts tab, and the list of hosts
	fs.writeFileSync( hostFile, "" );
	$("#hosts").html("");
	hosts = [];
	
	// getting when you change channel because it's channel-specific
	getEmoticonsBTTV();

	getFollowers();

	// get subscriber image URL of the channel you're in
	$.getJSON(
		"https://api.twitch.tv/kraken/chat/" + settings.channel.substring(1) + "/badges",
		{
			"client_id" : clientid,
			"api_version" : 3
		},
		function( response ) {
			if ( response.subscriber !== null ) {
				subBadgeUrl = response.subscriber.image;
			}
		}
	);
	
	// get id of the channel you're in and current game and stream title
	$.getJSON(
		"https://api.twitch.tv/kraken/channels/" + settings.channel.substring(1),
		{
			"client_id" : clientid,
			"api_version" : 3
		},
		function( response ) {
			settings.id = response._id;
			save();
			$("#gameField").val( response.game );
			$("#statusField").val( response.status );
		}
	);
}

function updateHosts() {
	// get hosts into json
	if ( settings.id == null ) return;
	
	$.getJSON(
		"http://tmi.twitch.tv/hosts",
		{
			"include_logins" : "1",
			"target" : settings.id
		},
		function( response ) {
			// make an array of current hosts
			for ( var i = 0; i < response.hosts.length; i++ ) {
				var tempHost = response.hosts[i].host_login;
				if( hosts.indexOf( tempHost ) === -1 ) { // if the host is not in the current list of hosts
					// add to the list of hosts to prevent duplication in the future
					hosts.push( tempHost );

					// add to the hosts tab
					$("#hosts").append( getTimeStamp() + " Host: " + tempHost + "<br>" ); 

					// log the host
					log( "* " + getTimeStamp() + " " + tempHost + " is hosting " + settings.channel );

					// write to host file
					fs.appendFile( hostFile, tempHost + "\r\n", function ( err ) {
						if ( err ) log( "* Error writing to host file" );
					} );
				}
			}
		}
	);
}

function updateUserlist() {
	$.getJSON(
		"https://tmi.twitch.tv/group/user/" + settings.channel.substring(1) + "/chatters",
		{
			"client_id" : clientid,
			"api_version" : 3
		},
		function( response ) {
			
			if ( response.chatters == null || response.chatter_count === 0 ) return; // didn't load a user yet
			
			var output = "<b>Total viewers</b>: " + response.chatter_count + "<br>"; 
			
			exportViewers( response.chatter_count );
			
			var staffLen = response.chatters.staff.length;
			if ( staffLen > 0 ) {
				output += "<p> <b style='color: #6d35ac;'>STAFF (" + staffLen + ")</b> <br> ";
				for ( var i = 0; i < staffLen; i++ ) {
					output += response.chatters.staff[i] + " <br> ";
				}
				output += "</p> ";
			}

			var modLen = response.chatters.moderators.length;
			if ( modLen > 0 ) {
				output += "<p> <b style='color: #34ae0a;'>MODERATORS (" + modLen + ")</b> <br> ";
				for ( var i = 0; i < modLen; i++ ) {
					output += response.chatters.moderators[i] + " <br> ";
				}
				output += "</p> ";
			}

			var adminLen = response.chatters.admins.length;
			if ( adminLen > 0 ) {
				output += "<p> <b style='color: #faaf19;'>ADMINS (" + adminLen + ")</b> <br> ";
				for ( var i = 0; i < adminLen; i++ ) {
					output += response.chatters.admins[i] + " <br> ";
				}
				output += "</p> ";
			}

			var globalLen = response.chatters.global_mods.length;
			if ( globalLen > 0 ) {
				output += "<p> <b style='color: #1a7026;'>GLOBAL MODS (" + globalLen + ")</b> <br> ";
				for ( var i = 0; i < globalLen; i++ ) {
					output += response.chatters.global_mods[i] + " <br> ";
				}
				output += "</p> ";
			}

			var viewLen = response.chatters.viewers.length;
			if ( viewLen > 0 ) {
				output += "<p> <b style='color: #2e7db2;'>VIEWERS (" + viewLen + ")</b> <br> ";
				for ( var i = 0; i < viewLen; i++ ) {
					output += response.chatters.viewers[i] + " <br> ";
				}
				output += "</p> ";
			}

			$("#userlist").html( output );
		}
	);
}

function getEmoticons() {
	$.getJSON(
		"https://api.twitch.tv/kraken/chat/emoticons",
		{
			"client_id" : clientid,
			"api_version" : 3
		},
		function( response ) {
			if ( "emoticons" in response ) emoticonsTwitch = response.emoticons;
			else setTimeout( function() { getEmoticons(); }, 5*1000 );
		}
	);
}

function getEmoticonsBTTV() {
	$.getJSON(
		"https://api.betterttv.net/2/channels/" + settings.channel.substring(1),
		{},
		function ( response ) {
			if ( "emotes" in response ) emoticonsBTTV = response.emotes;
		}
	);

	$.getJSON(
		"https://api.betterttv.net/emotes",
		{},
		function ( response ) {
			if ( "emotes" in response ) emoticonsBTTVall = response.emotes;
		}
	);
}

function writeEmoticons( message ) {
	var output = "";
	var text = message.split(" ");
	
	// for each word, check if it's an emoticon and if it is, output the url instead of the text
	for( var i = 0; i < text.length; i++ ) {
		output += checkEmote(text[i]);
	}
	
	return output;
}

function checkEmote( word ) {
	// if the word is a single character, don't bother checking
	if( word.length < 2 ) return word + " ";

	// checking BTTV channel specific emotes first since it's smaller
	for( var j in emoticonsBTTV ) {
		if ( word === emoticonsBTTV[j].code )
			return "<img src='https://cdn.betterttv.net/emote/" + emoticonsBTTV[j].id + "/1x'> ";
	}

	// checking universal BTTV emotes
	for( var j in emoticonsBTTVall ) {
		if ( word === emoticonsBTTVall[j].regex )
			return "<img src='https:" + emoticonsBTTVall[j].url + "'> ";
	}

	// checking official Twitch emotes
	for( var j in emoticonsTwitch ) {
		if ( word === emoticonsTwitch[j].regex )
			return "<img src='" + emoticonsTwitch[j].images[0].url + "'> ";
	}
	
	// not an emote
	return word + " ";
}

function log( message ) {
	var out = document.getElementById("console");
	
 
	// scrollHeight = element's total height including overflow
	// clientHeight = element's height including padding excluding horizontal scroll bar
	// scrollTop = distance from an element's top to its topmost visible content, it's 0 if there's no scrolling needed
	// allow 1px inaccuracy by adding 1

	// if it's scrolled to the bottom within 20px before a chat message shows up, set isScrolledToBottom to true
	var isScrolledToBottom = out.scrollHeight - out.clientHeight <= out.scrollTop + 20;

	// add message
	$("#console").append( writeEmoticons(message) + "<br>" );

	// if it was scrolled to the bottom before the message was appended, scroll to the bottom
	if( isScrolledToBottom )
		out.scrollTop = out.scrollHeight - out.clientHeight;

	// remove html tags before writing to the log
	var wrapped = $("<div>" + message + "</div>");
	message = wrapped.text();

	// write to log
	fs.appendFile( logFile, message + "\r\n", function ( err ) {
		if ( err ) $("#console").append("* Error writing to log" + "<br>");
	} );
}

function chat() {
	// get the chat input box value
	var text = $("#chatText").val();
	
	// output it to the console
	log( getTimeStamp() + " <b>&gt;</b> " + text );
	
	// check if it was a command...
	if ( text.substring(0,1) === cmds.symbol ) {
		parseCommand( text, settings.username, "mod", true );
	} 
	else {
		// send the data to the irc server
		bot.say( settings.channel, text );
	}
	
	// clear the chat input box
	$("#chatText").val("");
}

function getTimeStamp() {
	var dt = new Date();
	var hrs = dt.getHours();
	var mins = dt.getMinutes();
	// var secs = dt.getSeconds();

	if ( hrs < 10 ) hrs = "0" + hrs;
	if ( mins < 10 ) mins = "0" + mins;
	// if ( secs < 10 ) secs = "0" + secs;

	return "[" + hrs + ":" + mins + "]";
}

function save() {
	// saving settings.ini
	fs.writeFile( execPath + "\\settings\\settings.ini", JSON.stringify( settings ), function ( err ) {
		if ( err ) log( "* Error saving settings" );
	} );

	// saving modSettings.ini
	fs.writeFile( execPath + "\\settings\\modSettings.ini", JSON.stringify( modSettings ), function ( err ) {
		if ( err ) log( "* Error saving modSettings" );
	} );

	// saving timedMessages.ini
	fs.writeFile( execPath + "\\settings\\timedMessages.ini", JSON.stringify( timedMessages ), function ( err ) {
		if ( err ) log( "* Error saving timedMessages" );
	} );

	// saving cmdSettings.ini
	fs.writeFile( execPath + "\\settings\\cmdSettings.ini", JSON.stringify( cmds ), function ( err ) {
		if ( err ) log( "* Error saving cmdSettings" );
	} );

	// saving raffleSettings.ini
	fs.writeFile( execPath + "\\settings\\raffleSettings.ini", JSON.stringify( raffleSettings ), function ( err ) {
		if ( err ) log( "* Error saving raffleSettings" );
	} );
}

function getFollowers() {
	followers = [];
	$.getJSON(
		"https://api.twitch.tv/kraken/channels/" + settings.channel.substring(1) + "/follows",
		{
			"limit": 100
		},
		function ( response ) {
			for ( var i = 0; i < response.follows.length; i++ ) {
				followers.push( response.follows[i].user.display_name );
			}
		}
	);
}

function updateFollowers() {
	$.getJSON(
		"https://api.twitch.tv/kraken/channels/" + settings.channel.substring(1) + "/follows",
		{
			"limit": 100
		},
		function ( response ) {
			if ( !("follows" in response) ) {
				return;
			}
			for ( var i = 0; i < response.follows.length; i++ ) {
				var tempUser = response.follows[i].user.display_name;
				if ( followers.indexOf(tempUser) == -1 ) {
					followers.unshift( tempUser );
					$("#hosts").append( getTimeStamp() + " Follow: " + tempUser + "<br>" );
					// cmdSay( "Thanks for following " + tempUser + "!" );
				} else {
					break;
				}
			}
		}
	);
}