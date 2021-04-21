const baseurl = "https://wap.tplinkcloud.com";
var proxyurl = "https://cors.smartathome.co.uk/";
var autoRefreshTimer;
var user_info = {};

$( document ).ready(function() {
	testFirstCookie();
	document.getElementById("password").onkeydown = function (e) {
		if (e.keyCode === 13) {
			do_login();
		}
	};
	user_info = {
		"kasa_token": getCookie("kasa_token"),
	};
	console.log(user_info);
	logged_in = check_login();
	console.log("logged_in");
	console.log(logged_in);
	if (logged_in["success"] === true) {
		user_info["devices"] = logged_in["devices"];
		on_login();
		user_info["logged_in"] = true;
	} else {
		on_logout();
		user_info["logged_in"] = false;
	}
	createEditableNames();
	readLocalStorage();
	$('#autorefresh').on("change", function () {
		localStorage.autoRefresh = $(this).prop("checked");
		checkAutorefresh();
	});
	checkAutorefresh();
});

function login(username, password, storecreds) {
	console.log("login");
	var url = baseurl;
	var data = {
		"method": "login",
		"params": {
			"cloudUserName": username,
			"cloudPassword": password,
			"appType": "Kasa_Android",
			"terminalUUID": uuidv4(),
		}
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			user_info["email"] = username;
			user_info["password"] = password;
			store_tokens(json, storecreds);
		}
	});
}

function store_tokens(json, storecreds) {
	console.log("store_tokens");
	if ("result" in json && "token" in json["result"]) {
		user_info["kasa_token"] = json["result"]["token"];
		user_info["logged_in"] = true;
		if (storecreds === true) {
			setCookie("kasa_token", json["result"]["token"], 24*365);
		}
	}
}

function get_device_list() {
	console.log("get_device_list");
	gdl_to_return = {};
	var url = baseurl+"?token="+user_info["kasa_token"];
	data = {
		"method": "getDeviceList"
	}
	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			if ("result" in json && "deviceList" in json["result"]) {
				gdl_to_return["devices"] = json["result"]["deviceList"];
				gdl_to_return["success"] = true;
				localStorage.devices = JSON.stringify(gdl_to_return["devices"]);
			}
		}
	});
	for (device of gdl_to_return["devices"]) {
		device["info"] = get_device_info(device);
	}
	return gdl_to_return;
}

function get_device_info(device) {
	console.log("get_device_info");
	var info = {};

	var a = "system";
	var b = "get_sysinfo";
	var c = null;
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"]
			&& "system" in success["result"]["responseData"]
			&& "get_sysinfo" in success["result"]["responseData"]["system"]) {
		info = success["result"]["responseData"]["system"]["get_sysinfo"];
	}

	return info;
}

function adjust_device(device, a, b, c) {
	console.log("adjust_device");
	ad_to_return = {};
	if ("appServerUrl" in device) {
		var url = device["appServerUrl"]+"?token="+user_info["kasa_token"];
	} else {
		var url = baseurl+"?token="+user_info["kasa_token"];
	}
	var device_id = device["deviceId"];
	var data = {
		"method": "passthrough",
		"params": {
			"deviceId": device_id,
			"requestData": {}
		}
	};
	data["params"]["requestData"][a] = {};
	data["params"]["requestData"][a][b] = c;

	$.ajax({
		url: proxyurl+url,
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify(data),
		dataType: "json",
		async: false,
		success: function (json) {
			console.log(json);
			ad_to_return = json;
		}
	});
	return ad_to_return;
}

function do_login() {
	console.log("do_login");
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.remove("hidden");
	var username = document.getElementById("username").value;
	var password = document.getElementById("password").value;
	var storecreds = document.getElementById("storecreds").checked;
	setTimeout(function(){
		login(username, password, storecreds);
		if (user_info["logged_in"] === true) {
			device_list = get_device_list();
			user_info["devices"] = device_list["devices"]
			on_login();
		} else {
			on_logout();
			document.getElementById("loginfailed").innerHTML = "Login failed";
		}
	}, 100);
}

function check_login() {
	console.log("check_login");
	if (user_info["kasa_token"] !== "") {
		device_list = get_device_list(false);
		return device_list;
	} else {
		console.log("No kasa_token");
		return {"success": false};
	}
}

function readLocalStorage(){
	// Not initialized
	if (localStorage.autoRefresh == null) {
		localStorage.autoRefresh = "true";
		localStorage.theme = "a";
	}
	$('#autorefresh').prop( "checked", localStorage.autoRefresh === "true").checkboxradio( "refresh" );
	if (localStorage.theme !== "a") {
		checkTheme();
	}
}

function checkTheme(){
	switchTheme();
	localStorage.theme = $("#page").attr("data-theme");
}

function checkAutorefresh(){
	clearInterval(autoRefreshTimer);
	if (localStorage.autoRefresh === "true" && user_info["logged_in"] === true) {
		autoRefreshTimer = setInterval(update_devices, 31_000);
	}
}

function on_login() {
	console.log("on_login");
	var login_div = document.getElementById("login");
	login_div.classList.add("hidden");
	var switches = document.getElementById("switches");
	switches.classList.remove("hidden");
	var buttons = document.getElementById("buttons");
	buttons.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
	update_devices();
	checkAutorefresh();
}

function update_devices() {
	console.log("update_devices");
	var devices = user_info["devices"];
	for (device_no in devices) {
		device = devices[device_no];
		device["info"] = get_device_info(device);
		add_or_update_switch(devices[device_no], device_no);
	}
}

function toggle(device_no) {
	console.log("toggle");
	var device = user_info["devices"][device_no];
	if ("relay_state" in device["info"]) {
		var state = device["info"]["relay_state"];
		var new_state = state ? 0 : 1;
		var a = "system";
		var b = "set_relay_state";
		var c = {"state": new_state};
	} else {
		var state = device["info"]["light_state"]["on_off"];
		var new_state = state ? 0 : 1;
		var a = "smartlife.iot.smartbulb.lightingservice";
		var b = "transition_light_state";
		var c = {"on_off": new_state};
	}
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"] &&
			a in success["result"]["responseData"] &&
			b in success["result"]["responseData"][a]) {
		if ("relay_state" in device["info"]) {
			device["info"]["relay_state"] = new_state;
		} else {
			device["info"]["light_state"] = success["result"]["responseData"][a][b];
		}
		add_or_update_switch(device, device_no);
	}
}

function change_brightness(device_no, new_brightness) {
	console.log("change_brightness: "+new_brightness);
	var a = "smartlife.iot.smartbulb.lightingservice";
	var b = "transition_light_state";
	var c = {"brightness": parseInt(new_brightness)};
	var device = user_info["devices"][device_no];
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"] &&
			a in success["result"]["responseData"] &&
			b in success["result"]["responseData"][a]) {
		device["info"]["light_state"] = success["result"]["responseData"][a][b];
		add_or_update_switch(device, device_no);
	}
}

function change_color_temperature(device_no, new_temperature) {
	console.log("change_color_temp: "+new_temperature);
	var device = user_info["devices"][device_no];
	var a = "smartlife.iot.smartbulb.lightingservice";
	var b = "transition_light_state";
	var c = {"color_temp": parseInt(new_temperature)};
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"] &&
			a in success["result"]["responseData"] &&
			b in success["result"]["responseData"][a]) {
		device["info"]["light_state"] = success["result"]["responseData"][a][b];
		add_or_update_switch(device, device_no);
	}
}

function auto_color_temperature(device_no) {
	console.log("auto_color_temp");
	var device = user_info["devices"][device_no];
	var a = "smartlife.iot.smartbulb.lightingservice";
	var b = "transition_light_state";
	var c = {"mode": "circadian"};
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"] &&
			a in success["result"]["responseData"] &&
			b in success["result"]["responseData"][a]) {
		device["info"]["light_state"] = success["result"]["responseData"][a][b];
		add_or_update_switch(device, device_no);
	}
}

function on_logout() {
	console.log("on_logout");
	var switches = document.getElementById("switches");
	switches.classList.add("hidden");
	var login_div = document.getElementById("login");
	login_div.classList.remove("hidden");
	var loader_div = document.getElementById("loader");
	loader_div.classList.add("hidden");
}

function add_or_update_switch(device, device_no){
	console.log("add_or_update_switch");
	var name = device["alias"];
	var device_id = device["deviceId"];
	var model = device["deviceModel"];
	var state = 0;
	if ("light_state" in device["info"]) {
		state = device["info"]["light_state"]["on_off"];
	} else if ("relay_state" in device["info"]) {
		state = device["info"]["relay_state"];
	}
	var online = device["status"];
	if (online == false) { state = false };
	var icon = device["icon"]; // probably null
	var currentActionDiv = $('#action_'+ device_id);
	if(currentActionDiv.length === 0) {
		var deviceDiv = createElement("div", "gridElem singleSwitch borderShadow ui-btn ui-btn-up-b ui-btn-hover-b switch_" + Boolean(state));
		var nameDiv = createElement("div", "switchName");
		nameDiv.innerHTML = name;
		nameDiv.id = "name_"+device_no;
		var imgTable = createElement("table", "switchImg");
		var imgTd = createElement("td");
		imgTd.innerHTML = createImg(icon, name, model);
		imgTable.appendChild(imgTd);
		if (device["info"]["is_color"] == 1 && online == true) {
			var cTd = createColorSelector(device, device_no);
			imgTable.appendChild(cTd);
		}
		var actionDiv = createElement("div", "switchAction");
		actionDiv.setAttribute("id", "action_" + device_id);
		actionDiv.innerHTML = createActionLink(device_no, online, state);
		deviceDiv.appendChild(imgTable);
		deviceDiv.appendChild(nameDiv);
		deviceDiv.appendChild(actionDiv);
		if (device["info"]["is_dimmable"] && online == true) {
			var bTable = createBrightnessSlider(device, device_no);
			deviceDiv.appendChild(bTable);
		}
		if (device["info"]["is_variable_color_temp"] && online == true) {
			var ctTable = createColorTempSlider(device, device_no);
			deviceDiv.appendChild(ctTable);
		}
		document.getElementById("switches").appendChild(deviceDiv);
	} else {
		var parentDiv = currentActionDiv.parent()[0];
		parentDiv.classList.remove("switch_true");
		parentDiv.classList.remove("switch_false");
		parentDiv.classList.add("switch_"+Boolean(state));
		currentActionDiv.remove();
		var newActionDiv = createElement("div", "switchAction");
		newActionDiv.setAttribute("id", "action_" + device_id);
		newActionDiv.innerHTML = createActionLink(device_no, online, state);
		parentDiv.appendChild(newActionDiv);
		if (device["info"]["is_dimmable"] && online == true) {
			document.getElementById("brightness_" + device_id).value = device["info"]["light_state"]["brightness"];
		}
		if (device["info"]["is_variable_color_temp"] && online == true) {
			document.getElementById("colortemp_" + device_id).value = device["info"]["light_state"]["color_temp"];
			if (device["info"]["light_state"]["mode"] == "circadian") {
				document.getElementById("autocolortemp_" + device_id).classList.add("highlightButton");
			} else {
				document.getElementById("autocolortemp_" + device_id).classList.remove("highlightButton");
			}
		}
	}
	setUpColors();
}

function createColorSelector(device, device_no){
	var cTd = createElement("td", "verticalAlignMiddle");
	var inp = document.createElement("input", "colorSelector");
	h = device["info"]["light_state"]["hue"];
	s = device["info"]["light_state"]["saturation"];
	v = device["info"]["light_state"]["brightness"];
	inp.value = "hsv("+h+", "+s+", "+v+")";
	inp.id = "color_"+device_no;
	cTd.appendChild(inp);
	return cTd;
}

function createBrightnessSlider(device, device_no){
	var device_id = device["deviceId"];
	var bTable = createElement("table", "switchBrightness");
	var bTd = createElement("td");
	var brightnessDiv = createElement("input", "slider100");
	brightnessDiv.id = "brightness_" + device_id;
	brightnessDiv.type = "range";
	brightnessDiv.min = 1;
	brightnessDiv.max = 100;
	brightnessDiv.value = device["info"]["light_state"]["brightness"];
	brightnessDiv.onchange = function () { change_brightness(device_no, this.value) };
	bTd.appendChild(brightnessDiv);
	bTable.appendChild(bTd);
	var bTd2 = createElement("td");
	bTd2.innerHTML = "&#128262;";
	bTable.appendChild(bTd2);
	return bTable;
}

function createColorTempSlider(device, device_no){
	var device_id = device["deviceId"];
	var ctTable = createElement("table", "switchColorTemp");
	var ctTd1 = createElement("td", "verticalAlignBottom");
	ctTd1.innerHTML = "<small>2500K</small>";
	ctTable.appendChild(ctTd1);
	var ctTd = createElement("td");
	var colorTempDiv = createElement("input", "colorTempSlider verticalAlignBottom");
	colorTempDiv.id = "colortemp_" + device_id;
	colorTempDiv.type = "range";
	colorTempDiv.min = 2500;
	colorTempDiv.max = 9000;
	colorTempDiv.value = device["info"]["light_state"]["color_temp"];
	colorTempDiv.onchange = function () { change_color_temperature(device_no, this.value) };
	ctTd.appendChild(colorTempDiv);
	ctTable.appendChild(ctTd);
	var ctTd2 = createElement("td", "verticalAlignBottom");
	ctTd2.innerHTML = "<small>9000K</small>";
	ctTable.appendChild(ctTd2);
	var ctTd3 = createElement("td");
	var but = createElement("button");
	but.innerHTML = "&#127748;&#127769;";
	but.id = "autocolortemp_" + device_id;
	but.onclick = function () { auto_color_temperature(device_no) };
	if (device["info"]["light_state"]["mode"] == "circadian") {
		but.classList.add("highlightButton");
	}
	ctTd3.appendChild(but);
	ctTable.appendChild(ctTd3);
	return ctTable;
}

function createActionLink(device_no, online, state){
	if (online == false) {
		return '<a href="#" class="borderShadow ui-btn ui-disabled ui-btn-inline ui-icon-power ui-btn-icon-left">Offline</a>';
	} else if (state == false) {
		return '<a href="#" class="borderShadow ui-btn ui-btn-b ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device_no+');">Off</a>';
	} else {
		return '<a href="#" class="borderShadow ui-btn ui-btn-inline ui-icon-power ui-btn-icon-left" onclick="toggle('+device_no+');">On</a>';
	}
}

function createImg(icon, name, model){
	if (isNullOrEmpty(icon)) {
		return "<p>" + model + "</p>";
	}
	return "<img width=50 src='" + icon + "' alt='" + name + "'>";
}

function createElement(typeName, className){
	var elem = document.createElement(typeName);
	if (!isNullOrEmpty(className)) {
		elem.className = className;
	}
	return elem;
}

function isNullOrEmpty(entry){
	return entry == null || entry === '';
}

function logout() {
	setCookie("kasa_token", "", -1);
	location.reload();
}

function setUpColors() {
	$("[id^=color_]").spectrum({
		type: "color",
		hideAfterPaletteSelect: true,
		showInitial: true,
		showAlpha: false,
		allowEmpty: false,
		change: function() {
			changeColor(this)
		}
	});
	$(".color_disabled").spectrum("disable");
}

function changeColor(element) {
	device_no = element.id.replace("color_", "");
	var device = user_info["devices"][device_no];
	var t = $("#"+element.id).spectrum("get");
	var hsv = t.toHsv();
	var h = parseInt(hsv["h"]);
	var s = parseInt(hsv["s"]*100);
	var v = parseInt(hsv["v"]);
	var a = "smartlife.iot.smartbulb.lightingservice";
	var b = "transition_light_state";
	var c = {"hue": h, "saturation": s, "color_temp": 0};
	success = adjust_device(device, a, b, c);
	if ("result" in success && "responseData" in success["result"] &&
			a in success["result"]["responseData"] &&
			b in success["result"]["responseData"][a]) {
		device["info"]["light_state"] = success["result"]["responseData"][a][b];
		add_or_update_switch(device, device_no);
	}
}

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

function createEditableNames() {
	$(document).on("click", "div.switchName", function() {
		var thisid = event.target.id;
		var txt = $(this).text();
		$(this).replaceWith("<input id='"+thisid+"' class='switchName'/>");
		$("#"+thisid).val(txt);
		$("#"+thisid).data("prev", txt);
		$("#"+thisid).focus();
		$("#"+thisid).select();
	});

	$(document).on("keydown", "input.switchName", function(e) {
		if (e.which == 13) { // enter key
			event.preventDefault();
			var txt = $(this).val();
			var thisid = event.target.id;
			var prev = $("#"+thisid).data("prev");
			$(this).replaceWith("<div id='"+thisid+"' class='switchName'></div>");
			var a = "system";
			var b = "set_dev_alias";
			var c = {"alias": txt};
			var device_no = thisid.replace("name_", "");
			var device = user_info["devices"][device_no];
			success = adjust_device(device, a, b, c);
			if (success["error_code"] == 0) {
				$("#"+thisid).text(txt);
			} else {
				$("#"+thisid).text(prev);
			}
		}
	});
}

