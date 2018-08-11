/* This mostly just manages the localStorage and AJAX, and then wraps it in HTML to pass off to the
jQuery mobile listview. */

var JSON_URL = "corrected_rex2018.json"

var searchHidden = true;
var eventsJSON = Array();
var savedEvents = Array();
var firstScreen = true;
var lastFilter;
var lastList;

//This hash ensures the freshness of the event database. Change it when the DB updates
var integrityHash = "9ac386beed4f3f7b5eb25bf35497893bd099c95d";

function RexEvent(id, title, owner, start, end, tags, desc, location) {
	this.id = id;
	this.title = title;
	this.owner = owner;
	this.start = start;
	this.end = end;
	this.tags = tags;
	this.desc = desc;
	this.location = location;
}

RexEvent.prototype.hasTag = function(tag) {
	return this.tags.indexOf(tag) >= 0;
};

RexEvent.prototype.compareTitles = function(other) {
	if(this.title.toUpperCase() > other.title.toUpperCase()) return 1;
	if(other.title.toUpperCase() > this.title.toUpperCase()) return -1;
	return 0;
};

RexEvent.prototype.compareDates = function(other) {
	if(this.start > other.start) return 1;
	if(other.start > this.start) return -1;
	return 0;
};

RexEvent.prototype.compareDatesEnd = function(other) {
	if(this.end > other.end) return 1;
	if(other.end > this.end) return -1;
	return 0;
};

RexEvent.prototype.getTags = function() {
	var tagsout = Array();
	for(var x = 0; x < this.tags.length; x++) {
		switch(this.tags[x]) {
			case "food" : tagsout.push("Food"); break;
			case "tour" : tagsout.push("Tour"); break;
			case "housing" : tagsout.push("Official Orientation Event"); break;
			case "party" : tagsout.push("Party"); break;
		}
	}
	if(tagsout.length > 0) {
		return " | "+tagsout.join(", ");
	} else {
		return "";
	}
};

RexEvent.prototype.isHappening = function() {
	//Returns true if the event is currently ongoing or starting soon
	var now = new Date();
	if(this.tags.indexOf("allday") >= 0) {
		//All day
		return this.start.getDate()==now.getDate() && this.start.getMonth()==now.getMonth();
	} else {
		//Has a start time
		if(this.start.getTime()-(15*60000) >= now.getTime()) {
			//Has started or is starting in 15 min.
			if(this.tags.indexOf("noend") >= 0) {
				//No end time --consider it over after an hour.
				return now.getTime() <= this.start.getTime()+60*60000;
			} else {
				//End time is set
				return now < this.end;
			}
		}
	}
	return false;
};

RexEvent.prototype.friendlyDate = function() {

	days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
	months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
	
	str = "";
	
	if(this.tags.indexOf("allday") >= 0) {
		//This is an all-day event
		str = "[All Day] " + days[this.start.getDay()] + " " + months[this.start.getMonth()] + " " + this.start.getDate().toString(); 
	} else {
		//This has a start time (and possibly an end time)
		str = days[this.start.getDay()] + " " + months[this.start.getMonth()] + " " + this.start.getDate().toString() + " " + formatTime(this.start);
		
		if(this.tags.indexOf("noend") >= 0) {
			//No end time
			
		} else {
			//End time
			if(this.start.getDate() != this.end.getDate()) {
				str += " &mdash; " + days[this.end.getDay()] + " " + formatTime(this.end);
			} else {
				str += " &mdash; " + formatTime(this.end);
			}
		}
	}
	
	return str;
};

RexEvent.prototype.getHTML = function(highlight) {

	return "\
	<div data-role='collapsible' id='list"+this.id+"' data-collapsed='true'"+ (highlight ? " style='border: medium black solid;'" : "") +">\
	<h3><span class='title'>" + this.title + "</span><br/><span class='date'>" + this.friendlyDate() + "</span></h3>\
	<p>" + this.desc + "</p>\
	<p><strong>"+ this.owner + "</strong>"+this.getTags()+"</p>\
	<a href='javascript:App.setFav("+this.id+");' data-role='button' data-mini='true'>Add to Favorites</a>\
	</div>\
	";
};


var App = {

	eventsJSON 	: null,

	init	:	function() {	
		//Initialize JSON listview
		//$("#eventList").accordion();
		
		$("#currentList").html('<h2 id="heading">Loading Events...</h2>');

	  	//Init saved events
		if(!localStorage.getItem("savedEvents")){
			localStorage.setItem("savedEvents", JSON.stringify([]));
		}
		
		this.downloadJSON();
		
	},
	
	populate	:	function() {
		//Sorts events by start time
		this.eventsJSON.sort(function(a, b){
			return a.compareDates(b);
		});
		
		//Write out all the HTML
		var indexDate = null;
		for(x = 0; x < this.eventsJSON.length; x++) {
			if(indexDate != this.eventsJSON[x].start.getDate()) {
				indexDate = this.eventsJSON[x].start.getDate();
				this.printHeader("<h3>" + (this.eventsJSON[x].start.getMonth()+1) + "/" + this.eventsJSON[x].start.getDate() + "</h3>");
			}
			this.printEvent(this.eventsJSON[x]);
		}
		
		//Refresh Collapsible Set
		$("#currentList").collapsibleset('refresh');
		
		//Show them
		this.updateLists();
	},
	
	downloadJSON	:	function(){
		$.ajax({
			url: JSON_URL,
			context: this,
			success: function(data){

				console.log("JSON downloaded");
			
				this.eventsJSON = this.loadFromStorage(data);
				
				this.populate();
			}
		});
	},
	
	loadFromStorage	:	function(r) {
		var rexeventlist = Array()
		for(var x = 0; x < r.length; x++) {
			rexeventlist.push(new RexEvent(
				r[x].id,
				r[x].name,
				r[x].group,
				new Date(Date.parse(r[x].starttime)),
				new Date(Date.parse(r[x].endtime)),
				r[x].tags,
				r[x].description,
				r[x].location
			));
		}
		return rexeventlist;
	},
	
	updateLists		:	function(filter_obj){
		
		if(filter_obj == undefined) {
			filter_obj = {mode: "off", q: ""};

		}
		
		//Clear search fields and selected filters
		this.quickSearch("");
		$("#options").find("button").removeClass("selected");
		$("#btn_" + filter_obj.mode).addClass("selected");


		if(filter_obj.mode == "off") {
			//By default, show events that aren't over
			
			$("#heading").html("Current and Upcoming Events");
			
			var now = new Date();
			
			for(var x=0; x < this.eventsJSON.length; x++) {
				if(this.eventsJSON[x].end > now) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}
		}

		if(filter_obj.mode == "all"){
			//Shows All Events

			$("#heading").html("All Events");

			for(var x=0; x < this.eventsJSON.length; x++) {
				$("#list" + this.eventsJSON[x].id).show();
			}
			
		}
		
		if(filter_obj.mode == "day") {
			//Events on a specific date
			
			$("#heading").html('All Events on '+filter_obj.m.toString()+'/'+filter_obj.d.toString());
			

			for(var x=0; x < this.eventsJSON.length; x++) {
				if(this.eventsJSON[x].start.getDate() == filter_obj.d && this.eventsJSON[x].start.getMonth()+1 == filter_obj.m) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}

		}
		
		if(filter_obj.mode == "over") {
			//Events that are already over
			
			$("#heading").html('All Concluded Events');
			
			var now = new Date();
			
			for(var x=0; x < this.eventsJSON.length; x++) {
				////console.log(value);
				if(this.eventsJSON[x].end < now) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}

		}
		
		if(filter_obj.mode == "dorm") {
			//Filter by dorm
			
			$("#heading").html('Filter by Dorm: ' + filter_obj.q);
			
			//Sort by time
			this.eventsJSON.sort(function(a, b){
				return a.compareDates(b);
			});
			
			for(var x=0; x < this.eventsJSON.length; x++) {
				if(this.eventsJSON[x].owner.indexOf(filter_obj.q) != -1) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}
		}
		
		if(filter_obj.mode == "saved") {
			
			//Filter by saved status
			
			$("#heading").html('Saved Events');
			
			var saved = JSON.parse(localStorage.getItem("savedEvents"));
			
			//Put finshed events at the bottom
			for(var x=0; x < this.eventsJSON.length; x++) {
				if(saved.indexOf(this.eventsJSON[x].id) >= 0) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}
			
		}
		
		/*
		if(filter_obj.mode == "search") {
			//Filter by saved status
			
			$("#eventList").html('<li data-role="list-divider">Filter by Search: ' + filter_obj.q + '</li>');
			
			$.each(eventsJSON, function(index, value) {
				
				if(value.name.toLowerCase().indexOf(filter_obj.q.toLowerCase()) >= 0 || value.description.toLowerCase().indexOf(filter_obj.q.toLowerCase()) >= 0 || value.location.toLowerCase().indexOf(filter_obj.q.toLowerCase()) >= 0) {
					print_event(value);
				}
			});
		}
		*/
		
		if(filter_obj.mode == "tag") {
			//Filter by dorm
			
			$("#heading").html('<li data-role="list-divider">Filter by Tag: ' + filter_obj.q + '</li>');
			
			for(var x=0; x < this.eventsJSON.length; x++) {
				if(this.eventsJSON[x].hasTag(filter_obj.q)) {
					$("#list" + this.eventsJSON[x].id).show();
				} else {
					$("#list" + this.eventsJSON[x].id).hide();
				}
			}
		}
		
		this.hideSearch();

	},
	
	quickSearch		:	function(searchArgs){
		//Replaces the updateLists search function
		//Variables are perserved for legacy reasons
		$(".ui-input-search").find("input").val(searchArgs.q);
		$("#eventList").listview("refresh");
	},
	
	toggleSearch	:	function(){
		//Check whether options dialog is shown
		if($("#options").hasClass("hidden")){
			$("#backBtn").show();
			$("#searchBtn").hide();
			$(".ui-input-search").show();
			$("#options").show();
			$("#options").removeClass("hidden");
			$('html, body').animate({scrollTop : 0},800);
		}else{
			$("#backBtn").hide();
			$("#searchBtn").show();
			$(".ui-input-search").hide();
			$("#options").hide();
			$("#options").addClass("hidden");
		}
	},
	
	//Hide search is used by the filters
	hideSearch	:	function(){
		$("#backBtn").hide();
		$("#searchBtn").show();
		$(".ui-input-search").hide();
		$("#options").hide();
		$("#options").addClass("hidden");
		$('html, body').animate({scrollTop : 0},500);
	},
	
	printEvent	:	function(event) {
		
		if(event.hasTag("dontprint")) return;
		
		var hilite = event.hasTag("housing") || event.hasTag("large") || event.hasTag("nooverlap");
		
		$("#currentList").append(event.getHTML(hilite))
	},
	
	printHeader	:	function(text) {
		$("#currentList").append(text);
	},
	
	setFav	:	function (id){
		var saved = JSON.parse(localStorage.getItem("savedEvents"));
		if(saved.indexOf(id) >= 0){
			saved.splice(saved.indexOf(id), 1); //Remove saved event
		}else{
			saved.push(id);
		}
		localStorage.setItem("savedEvents", JSON.stringify(saved));
	}
	
};



$(document).ready(function(){
	App.init();
});



function formatTime(dateobj) {
	h = ((dateobj.getHours() + 11) % 12 + 1);
	m = dateobj.getMinutes();
	ampm = dateobj.getHours() >= 12 ? "PM" : "AM";
	return h.toString() + ":" + (m<10 ? "0" : "") + m.toString() + " " + ampm;
}
