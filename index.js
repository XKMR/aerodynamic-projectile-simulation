const fs = require("fs");

const stepTime = 0.03; //change the precision of the simulation, lower is more  precise. seconds/step
const emptyMass = 20; //Kg - doesn't matter for this version
const fuelMass = 60; // mass of the fuel
const boostTime = 10; // time that engine is burning (s)
const boostForce = 2000; // force produced by the booster (N)
const dragMultiplierAtSea = 0.001; // drag multiplier
const wingArea = 10000;
const gravity = 9.8; //gravity in m/s^2
const speedRegulation = 500; //limit the speed of the simulation - zero for no regulation
const totalStepGoal = 800; //total number of steps to be done if the useElimit is false
const startPosition = { x: 10, y: 1, th: Math.PI / 2 }; //starting height
const groundImpactDetection = true; //stop when hit ground
const doDraw = true; //weather to draw the object on the terminal
const drawingScale = 10; //to scale the drawing (used to prevent the object from going to the next line of the terminal)
const reportE = true; //weather to report the E value of the object in the terminal
const reportX = true; //weatehr to report the X value of the object in the terminal
const reportV = true; //weatehr to report the V value of the object in the terminal
const reportFt = true; //weatehr to report the Ft value of the object in the terminal
const reportFd = true; //weatehr to report the Ft value of the object in the terminal
const reportBooster = true; //weatehr to report the ingition value of the object in the terminal
const reportAOA = true;
const reportCommandAngle = true;
const reportG = true;
const reportM = true; //weatehr to report the m value of the object in the terminal
const recordHistory = true; //weather to make files
const startingVelocity = { x: 100, y: 100, total: 0, th: 0 }; //starting velocity (negative is downwards)
const bodyLength = 3; // m, used for moment of inertia
const momentArm = 1.5; // m, distance from nozzle to center of mass

const startTime = Date.now();
let date = new Date(startTime);
var xhistory = []; //used to store the x values separately to prevent the proccess of storing them to slow the simulation down
var yhistory = [];
var Ehistory = []; //same for the E values
var Vhistory = []; //same for the V values
var Fdhistory = [];
var Fthistory = [];
var mhistory = [];
var thistory = [];
var anglehistory = [];
var canglehistory = [];
var aoahistory = [];
var ghistory = [];

var a = { x: 0, y: 0 };
var G = 0;
var AOA = 0;
var commandAngle = (4 * Math.PI) / 180;
var boosterIgnited = true;
var mass = emptyMass + fuelMass;
var burnRate = fuelMass / boostTime;
var x = 0;
var bounce = 0; //number of bounces
var E;
var velocity = { ...startingVelocity };
var position = { ...startPosition };
var dragMultiplier = { ...dragMultiplierAtSea };
var currentBoostForce = boostForce;
var Fd = { x: 0, y: 0, total: 0 };
var v2 = 0;
// var direction = 0 (maybe when 2D version is made)

setInterval(function () {
	console.clear();
	if (boosterIgnited && stepTime * x >= boostTime) {
		currentBoostForce = 0;
		boosterIgnited = false;
	}
	G = distance(a.x, a.y) / 10;
	if (boosterIgnited) mass -= stepTime * burnRate;
	velocity.total = distance(velocity.x, velocity.y);
	v2 = velocity.total * velocity.total;
	dragMultiplier = dragMultiplierAtSea * Math.pow(1 - 0.0001, position.y);
	Fd.x = -dragMultiplier * velocity.total * velocity.x;
	Fd.y = -dragMultiplier * velocity.total * velocity.y;
	Fd.total = distance(Fd.x, Fd.y);
	[position, velocity] = step(position, velocity, currentBoostForce, Fd, mass, stepTime);
	if (reportE) E = mass * v2 * (1 / 2);
	if (recordHistory) {
		Ehistory[x] = E;
		Vhistory[x] = velocity.total;
		xhistory[x] = position.x;
		yhistory[x] = position.y;
		Fthistory[x] = currentBoostForce;
		Fdhistory[x] = Fd.total;
		mhistory[x] = mass;
		thistory[x] = x * stepTime;
		anglehistory[x] = position.th;
		canglehistory[x] = commandAngle;
		aoahistory[x] = AOA;
		ghistory[x] = G;
	}
	x += 1;

	if (x == totalStepGoal && groundImpactDetection == false) {
		end(xhistory);
	}
	if (position.y < 0 && groundImpactDetection == true) {
		console.log("Ground Impact");
		end(xhistory);
	}

	if (!groundImpactDetection) console.log(generateBar(x, totalStepGoal, 60) + x + "/" + totalStepGoal);
	if (doDraw) console.log(draw(position, velocity, drawingScale));
	if (reportX) console.log(`x = ${roundt(position.x)}`);
	if (reportX) console.log(`y = ${roundt(position.y)}`);
	if (reportV) console.log(`V = ${roundt(velocity.total)}`);
	if (reportE) console.log(`E = ${roundt(E)}`);
	if (reportFt) console.log(`Ft = ${roundt(currentBoostForce)}`);
	if (reportFd) console.log(`Fd = ${roundt(Fd.total)}`);
	if (reportM) console.log(`m = ${roundt(mass)}`);
	if (reportAOA) console.log(`Angle = ${roundt(position.th)}`);
	if (reportAOA) console.log(`AOA = ${roundt(AOA)}`);
	if (reportCommandAngle) console.log(`command angle = ${roundt(commandAngle)}`);
	if (reportG) console.log(`G = ${roundt(G)}`);
	if (reportBooster) console.log(`booster = ${boosterIgnited}`);
}, stepTime * speedRegulation); //step time

function generateBar(current, total, barSize) {
	var bar = "";
	var numberOfFilledSpaces = Math.round((current / total) * barSize);
	var numberOfEmptySpaces = barSize - numberOfFilledSpaces;
	var filledCharacters = "";
	var emptyCharacters = "";
	for (var n = 0; n < numberOfFilledSpaces; n += 1) {
		filledCharacters += "=";
	}
	for (var n = 0; n < numberOfEmptySpaces; n += 1) {
		emptyCharacters += " ";
	}
	bar = "[" + filledCharacters + emptyCharacters + "]";
	return bar;
}

function step(pos, V, Ft, Fd, m, t) {
	const Ftx = Ft * Math.cos(pos.th + commandAngle);
	const Fty = Ft * Math.sin(pos.th + commandAngle);

	AOA = Math.atan2(V.y, V.x) - pos.th;
	const sinAOA = Math.sin(AOA);

	const I = (m * bodyLength * bodyLength) / 12; // uniform rod, changes as fuel burns
	const tvcTorque = -Ft * Math.sin(commandAngle) * momentArm;
	const aeroTorque = Math.sign(sinAOA) * sinAOA * sinAOA * wingArea * dragMultiplier;

	V.th += ((tvcTorque + aeroTorque) / I) * t;
	pos.th += V.th * t;

	a.x = (Ftx + Fd.x) / m;
	V.x = V.x + a.x * t;
	pos.x = pos.x + V.x * t;
	a.y = (Fty + Fd.y) / m - gravity;
	V.y = V.y + a.y * t;
	pos.y = pos.y + V.y * t;
	return [pos, V];
}

function draw(position, V, scale) {
	var plot = "";
	for (var y = 47; y >= 0; y -= 1) {
		for (var x = 0; x < 400; x += 1) {
			if (Math.round(position.x / scale) == x && Math.round(position.y / scale) == y) plot += "X";
			else plot += " ";
		}
		plot += "\n";
	}
	return plot;
}

function roundt(n) {
	return Math.round(n * 10) / 10;
}

function distance(x, y) {
	return Math.hypot(x, y);
}

function end(xhistory) {
	const endTime = Date.now();
	if (recordHistory) {
		var output = "t,x,y,v,Ft,Fd,E,m,th,cth,aoa,g\n";
		for (var i = 0; i < thistory.length; i++) {
			output += `${thistory[i]},${xhistory[i]},${yhistory[i]},${Vhistory[i]},${Fthistory[i]},${Fdhistory[i]},${Ehistory[i]},${mhistory[i]},${anglehistory[i]},${canglehistory[i]},${aoahistory[i]},${ghistory[i]}\n`;
		}
		fs.writeFileSync(`DATA-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}${date.getMinutes()}${date.getSeconds()}.csv`, output);
	}
	var totalTime = Math.round((endTime - startTime) / 100) / 10;
	console.log(`Simulation compelited`);
	console.log(`made ${x} steps in ${totalTime} seconds.`);
	console.log(`each step was ${stepTime} seconds, the simulation was running at ${Math.round(((x * stepTime) / totalTime) * 1000) / 10}% of irl speed`);
	console.log(`average performance of ${Math.round((x / totalTime) * 10) / 10} steps/second`);
	console.log(`recorded ${bounce} bounces.`);
	if (recordHistory) {
		console.log("data exported to txt files");
	} else {
		console.log("no data was recorded, to enable: recordHistory = true");
	}
	process.exit();
}
