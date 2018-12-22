
//require('bootstrap');
var THREE = require('three');
import cameraControlsFactory from 'camera-controls';
const OrbitControls = cameraControlsFactory( THREE ); // special npm built by someone with programatic camera controls
var isWebglEnabled = require('detector-webgl');
//var ColladaLoader = require('three-collada-loader'); // isnt using the most up to date loader !
import "./three/js-libs/loaders/ColladaLoader.js";
import "./three/js-libs/shaders/CopyShader.js";
import "./three/js-libs/shaders/FXAAShader.js";
import "./three/js-libs/postprocessing/EffectComposer.js";
import "./three/js-libs/postprocessing/RenderPass.js";
import "./three/js-libs/postprocessing/ShaderPass.js";
import "./three/js-libs/postprocessing/OutlinePass.js";	

import createGeom from "./initGeom.js";

var traverseJS = require('traverse');
var _ = require('lodash');

if ( ! isWebglEnabled ) Detector.addGetWebGLMessage();
var mesh, decal;
var raycaster = new THREE.Raycaster();
var composer, effectFXAA, outlinePass;    


var params = {
	edgeStrength: 3.0,
	edgeGlow: 0.0,
	edgeThickness: 2.0,
	pulsePeriod: 0,
	rotate: false,
	usePatternTexture: false
};
/*
	boundedList: [
		{name:'home', parent:{}, directChildren:[{}], allChildren:[{}], ancestors:[{}], selfFade:false, parentFade:false},
*/
var heirarchySystem = {
	scene:{},
	boundedList:[],
	sceneHierarchy: {},
	buildHiearchy:function (scenePassed,blPassed) {
		this.scene = scenePassed;
		this.boundedList = blPassed;

		for (var i=0; i < this.boundedList.length; i++)
		{
			this.buildBoundingData(this.scene.getObjectByName(this.boundedList[i].name), this.boundedList[i]); // build object data	

		}
		for (var i=0; i < this.boundedList.length; i++)
		{
			this.boundedList[i].path = this.getPath(this.scene.getObjectByName(this.boundedList[i].name)); // build paths
			this.constructHeirarchy (this.sceneHierarchy,  this.boundedList[i]); // build the hierarchy
			this.buildMyObjList (this.boundedList[i]);
	
		}

		this.recurseHeirarchy(this.sceneHierarchy.bboxGroup_home,this.sceneHierarchy.bboxGroup_home);  //rootObject, parent

		/*var diff = _.differenceBy(this.boundedList[0].allChildren, this.boundedList[1].allChildren, 'name');
		console.log ('diff',diff);*/
		console.log (this.sceneHierarchy);
	}, 
	buildMyObjList: function (boundList){
	
		var objList = [];
		var path = {};
		var startLevel;

		path = heirarchySystem.getPath(boundList.sceneRef);
		startLevel = path.level;

		boundList.sceneRef.traverse(function (obj) {
			if (obj instanceof THREE.Mesh){
				//console.log('obj mesh',obj);
				path = heirarchySystem.getPath(obj);
				//console.log('called outside obj.uuid',obj.uuid);
				if (path.level == startLevel){
					var objData = {};	
					objData.name = obj.name;
					objData.id = obj.id;
					objData.meshRef = obj;
					objList.push(objData)
				}
			}
		});
		boundList.myMeshes = objList;
		//console.log('objList',objList);
	},
	recurseHeirarchy: function (base, root){
		var sceneObjmyScene = null;
		if (base.children)
		for (var i=0;i < base.children.length;i++){
			base.children[i].realParent = base;
			sceneObjmyScene = myScene.scene.getObjectByName(base.children[i].name);
			/*var currentBoundedList = _.																								(heirarchySystem.boundedList, {'name':base.children[i].name});
			currentBoundedList.hierarchyRef = base.children[i]	*/													
			sceneObjmyScene.linkToHeirarchy = base.children[i];

			if (base.children[i].path.level > 2){
				var ancestors = [];
				heirarchySystem.getAncestors(this.sceneHierarchy.bboxGroup_home, base.children[i],ancestors )
			}

			if (base.children[i].children)
				heirarchySystem.recurseHeirarchy(base.children[i],base);
		}
	},
	getAncestors: function (base,skip, ancestors	){
		if (base.children)
		for (var i=0;i < base.children.length;i++){
			console.log ('base.children[i].children',base.children[i].name);
			if (base.children[i].children){
				heirarchySystem.getAncestors(base.children[i]);	
			}
		}
	},
	getPath:function (childObj) {
		var path = {};
		var pathArray = [];
		var count = 0;
		var obj = childObj;

		do {
			if (obj.name.split('_',1) == 'bboxGroup'){

				
				if (obj.name == 'bboxGroup_home'){
					pathArray.push(obj.name);
				}else {
					var currentBoundedList = _.find(heirarchySystem.boundedList, {'name':obj.name});
					pathArray.push(currentBoundedList.childPosition);
					pathArray.push('children');
				}
				count++;
			}
			if (obj.parent.name.length){
				parent = this.scene.getObjectByName(obj.parent.name);
				obj = this.scene.getObjectByName(obj.parent.name);
			}			
		}
		while (obj.parent.name.length);

		path.level = count-1;
		pathArray.reverse();
		path.array = pathArray;
		path.string = pathArray.join('.');
		return (path);

	},
	buildBoundingData:function (childObj,childBoundedList) {
		var count = 0;
		var obj = childObj;

		var childData = {};
	
		var parentData = {};

		childData.SceneRef = childObj;
		childData.name = childObj.name;
		childData.link = childBoundedList;
		do {
			if (obj.name.split('_',1) == 'bboxGroup'){
				if (count == 0){ // obj is the starting child
					childBoundedList.sceneRef = childObj;
					childBoundedList.me = childData;
				}
				if (count == 1){// obj is the parent
					parentData.SceneRef = obj;
					parentData.name = obj.name;
					var parentBoundedList = _.find(this.boundedList, {'name':obj.name});
					parentData.link = parentBoundedList;
					childBoundedList.childPosition = parentBoundedList.directChildren.length
					parentBoundedList.directChildren.push(childData);
					parentBoundedList.allChildren.push(childData);
					childBoundedList.parent = parentData;		
				}
				if (count > 1){// obj is an ancestor
					var ancestorData = {};
					ancestorData.SceneRef = obj; // set ancestor object ready to push to child ancestor array
					ancestorData.name = obj.name;
					console.log ('ancestorData.name',ancestorData.name);
					var ancestorBoundedList = _.find(this.boundedList, {'name':obj.name});
					ancestorBoundedList.allChildren.push(childData);
					childBoundedList.ancestors.push(ancestorData);
				}
				count++;
			}
			if (obj.parent.name.length){
				parent = this.scene.getObjectByName(obj.parent.name);
				obj = this.scene.getObjectByName(obj.parent.name);
			}			
		}
		while (obj.parent.name.length);
	},
	constructHeirarchy: function( base, objHierarchyInfo, value ) {
		_.set(base, objHierarchyInfo.path.array, objHierarchyInfo);
	}
}



/* ****************  myScene HOLDS THE SCENE DATA FOR MANIPULATION IN AN ARRAY OF OBJECTS **************** */
var myScene = {
	scene: new THREE.Scene(),
	loaded: false,
	clock: new THREE.Clock(), // instantiates a clock to use for getting the time delta between frames to calculate animations
	bboxMat: new THREE.MeshLambertMaterial(), // Bbox material  
	initialColor: new THREE.Color().setRGB( 0.0, 0.0, 0.0 ),
	hoverColor: new THREE.Color().setRGB( 0.2, 0.2, 0.2 ),
	clickColor: new THREE.Color().setRGB( 0.15, 0.15, 0.2 ),

	camToLoad: ['cam0'],//  null or array of strings ['nameofobject3d']
	//fileToLoad: 'maya2017/exports/multimeter2017-meter2018.dae',
	fileToLoad: '../exports/auto-export-groups.dae',
	texturePath: 'maya2017/sourceimages/',
	boundedList: [
		{name:'home', realParent: null, parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'car',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:true, parentFade:false},
		{name:'seats',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'engine',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'mainBoot',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'tableTop',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'mySphere',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'innerTableTop',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'mySphere2',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'mySphere3',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false},
		{name:'pSphere2',  parent:null, directChildren:[], allChildren:[], ancestors:[], selfFade:false, parentFade:false}
	], // null or array of strings ['nameofobject3d']

	raycaster: new THREE.Raycaster(),

	maps: [  
		//{name:'lightmap',type:'lightmap',format:'.jpg',recursion:2,image: null,path:''} 
		// recursion 0 = object only 
		// recursion 1 = object plus direct chidren only
		// recursion 2 = object plus all descendants (full recursion)
		// add as many more textures and types here: {name:'multimeter',type:'lightmap',format:'jpg',recursion:2}
	], 
	changePolyColor: function ()  {
		obj.geometry.faces[4].color.setRGB (0.5,0.3,1);
		obj.geometry.faces[ 5 ].color.setRGB(color); // or use set()
		obj.geometry.colorsNeedUpdate = true;
		//console.log (obj);
	},
	sceneInitTraverse: function ()  {
		//bboxMatParams =  {color:'rgb(255,0,255)',emissive:'rgb(255,0,255)',wireframe:true}; // initialise the parameters of the bounding box material
		var bboxMatParams = { color: 0xffffff, flatShading : THREE.FlatShading, vertexColors: THREE.VertexColors,wireframe:true } ;
		myScene.bboxMat = new THREE.MeshBasicMaterial(bboxMatParams); // create the bbox material to be used for bounding box
		myScene.loaded = true;
		myScene.scene.updateMatrixWorld(  ); // **** NOTE: very important, needs to be called after files
		var color = new THREE.Color( 1, 0, 0 );
		myScene.scene.traverse(function (obj) {
			if (obj instanceof THREE.Mesh){
				obj.geometry.computeBoundingBox (); // calculate the bounding box dimensions (min/max as vec3s) for all meshes
			}

		});
	},
	calculateBoundingBox: function (obj, name) {
		/********* get inverse and send to origin *************/
		var originalMatrix = new THREE.Matrix4(); // stores the original transformations of object
		var invertedMatrix = new THREE.Matrix4(); // stores the original transformations of object

		var Box3 = new THREE.Box3(); // box utlity, getsize and getcenter
		var BoxHelper = new THREE.BoxHelper(); // for displaying bounding box, wireframe, 
		var center = new THREE.Vector3(); 
		var dimensions = new THREE.Vector3();
		var bboxGeom = new THREE.BoxGeometry(); // geometry for holding bounding box, needed for ray collision

		originalMatrix.copy (obj.matrixWorld); // Get copy of original Matrix
		obj.applyMatrix(invertedMatrix.getInverse ( obj.matrixWorld )); // apply the inverse / removal of all transforms
		obj.updateMatrix(); // update the matrix
		obj.name = 'bboxGroup_' + name; // name.charAt(0).toUpperCase() + name.slice(1);capatilises first letter and adds the rest after first letter
	 
		Box3.setFromObject ( obj); // set box dimensions from object
		Box3.getCenter(center); 
		Box3.getSize(dimensions); // save the dimensions into a vec3 for later

		bboxGeom = new THREE.BoxGeometry( dimensions.x,dimensions.y,dimensions.z); // init geometry NOTE: default world space 0,0,0
		var bbox = new THREE.Mesh( bboxGeom, myScene.bboxMat ); // apply defulat material from myscene object
		bbox.name = 'bboxMesh_' + name;
		myScene.scene.add( bbox ); // add the bounding box to the scene ready to attach to object later

		bbox.scale.set (1.02,1.02,1.02); // scale box a bit bigger than the object for collision 
		BoxHelper = new THREE.BoxHelper(bbox, 0xffff00); // create the box helper for displaying bounding volume (line segments)
		bbox.position.set (center.x,center.y,center.z); // now offset the box, important to do this afterboxhelper creation

		BoxHelper.scale.set(0.99,0.99,0.99); // Boxhelper is 1% larger than object but 1% less than bbox

		bbox.updateMatrix();
		BoxHelper.updateMatrix();

		THREE.SceneUtils.attach ( bbox, myScene.scene, obj );
		THREE.SceneUtils.attach ( BoxHelper, myScene.scene, bbox );
		
		//re-aapply all transformations
		obj.applyMatrix(originalMatrix);
		obj.updateMatrix(); //update
		return obj.name;
	
		/********* copy any matrix4 and stick it in a matrix4 object array *************/
		//myScene.identityMatrix4.copy (obj.matrixWorld); // copy the matrix position 

		/********* Send any object to the position, rotation and scale of any other (absolute or relative to local offset) *************/
		/*var rootPos = new THREE.Vector3(0,0,0);  
		cube.position.set (rootPos.x,rootPos.y,rootPos.z); // absolute position, leave out for relative positioning
		cube.updateMatrix();
		cube.applyMatrix (someObj.matrix); //or could be matrixWorld
		cube.updateMatrix(); // or could be updateMatrixWorld
		console.log('cube', cube);*/    
	},
	raycast: function  (pos, fromMouse)
	{
		var final = new THREE.Vector2();
		var offsetOfPageScroll = new THREE.Vector2();
		var finalOffset = new THREE.Vector2();
		var offsetOfDiv = $('#vp0').offset();
		var isIE11 = !!window.MSInputMethodContext && !!document.documentMode;

		offsetOfPageScroll.y = $('html').scrollTop();
		offsetOfPageScroll.x = $('html').scrollLeft();

		finalOffset.x = offsetOfDiv.left - offsetOfPageScroll.x;
		finalOffset.y = offsetOfDiv.top - offsetOfPageScroll.y;
/*
		if (!fromMouse){
			offsetOfDiv.left = 0; offsetOfDiv.top = 0;
		}
		
		if (isIE11)
		offsetOfDiv.left = 0; // a nasty hack for ie11 mouse odffset does not need to be offset for some weird reason that I cant work out
	*/
		final.x = ( (pos.x - finalOffset.x) / myView.dimensions.x ) * 2 - 1;
		final.y = -( (pos.y - finalOffset.y) / myView.dimensions.y ) * 2 + 1;
	
		// update the picking ray with the camera and mouse position
		if (pos.x != null && myScene.loaded == true) { // id there is a valid mouse position and the scene has loaded
			myScene.raycaster.setFromCamera(final, myView.camera);
	
			// calculate objects intersecting the picking ray
			var objArray = myScene.raycaster.intersectObjects(myScene.scene.children, true);
	
			if (objArray.length > 0){
				return objArray;
			}
			else{
				return false;
			}
		}
	},
/*
	setHighlight: function  (obj, color){
		
		if (obj.material instanceof THREE.MultiMaterial) {
			for (i = 0; i < obj.material.materials.length; i++) {
				obj.material.materials[i].emissive.r = color.r;
				obj.material.materials[i].emissive.g = color.g;
				obj.material.materials[i].emissive.b = color.b;
			}
		}
		else {
			obj.material.emissive.r = color.r;
			obj.material.emissive.g = color.g;
			obj.material.emissive.b = color.b;
		}
	},
	*/
	applyMap: function (obj3d, map){ // passes in the object to be textured and the type of texture to assign
		var type = map.type;
		var recursion = map.recursion;
		var didAssign = false;
		if (type=='lightmap'){
			switch(recursion) {
				case 0: // no recursion just apply direct to mesh in there is one
				if (obj3d.children[0] instanceof THREE.Mesh){
					obj3d.children[0].material.lightMap = map.image;
				}
				else{
					console.log ('Note: there is no mesh in root of object to apply lightmap');
				}
					break;
				case 1: // 1 level of recursion apply to direct mesh 1 level of children
					if (obj3d.children[0] instanceof THREE.Mesh){
						obj3d.children[0].material.lightMap = map.image;
						didAssign = true;
					}
					for (var i = 0, len = obj3d.children.length; i < len; i++) { 
						if (obj3d.children[i].children[0] instanceof THREE.Mesh) {
							obj3d.children[i].children[0].material.lightMap = map.image; // creates the correct name of the lightmap from the file name
							didAssign = true;
						}
					}
					if (didAssign == false){console.log ('Note: there is no mesh in root of object to apply lightmap');}
				break;
				case 2:
				obj3d.traverse(function(child) { // traverse the object and all its chidren 
					if (child instanceof THREE.Mesh) {
						child.material.lightMap = map.image; // creates the correct name of the lightmap from the file name
					}
				});
				if (didAssign == false){console.log ('Note: there is no mesh in root of object to apply lightmap');}
				break;
			}
		}
	}
};
var myView =
{
	vpDiv: null, // viewport div for instantiating the area to be rendered in to
	sceneCamStart: new THREE.Vector3(0, 0, 0),
	dimensions: new THREE.Vector2( 0, 0 ),
	background: new THREE.Color().setRGB( 1.0, 1.0, 1.0 ),
	up: [ 0, 1, 0 ],
	fov: 120,
	defaultFov:65,
	controls: null,
	camera: null,
	renderer: null,
	yaw: 0, // look left and right
	pitch: 0, // look up down angle
	look: false,
	setCamToOrbitControls: function (camRotation){
		var camTarget = new THREE.Vector3 (0,0,-0.1); // set a camera vector looking down z (toward scene)
		if (this.look == true){
			this.camera.localToWorld(camTarget); //set the vector coordinates to local vector space from camera.
		}
		//this.controls = new THREE.OrbitControls(this.camera,this.renderer.domElement,this.look,camRotation); // set the orbit controls
		this.controls = new OrbitControls(this.camera,this.renderer.domElement); // set the orbit controls
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.2;
		this.controls.enableZoom = true;
		this.controls.fov = this.fov;
		if (this.look == true){
			this.controls.target.set(camTarget.x,camTarget.y,camTarget.z);
		}
		this.controls.enabled = true;
		this.controls.update();
		console.log(this.controls);
	},
	setmyViewDimensions: function  (){
		this.dimensions.x = this.vpDiv.clientWidth;
		this.dimensions.y = this.vpDiv.clientHeight;
	}
};

/* ****************  LOADER **************** */

var manager = new THREE.LoadingManager();
manager.onLoad = function ( ) {
	myScene.sceneInitTraverse();
	$('.load-bar').css({'width':'100%'});
	$('#enter').stop().fadeToggle(200, "linear" );
	$('#enter').click(function() {
	$('.title-screen').stop(false).fadeToggle(500, "linear" );
	});
	init(); // call the initialisation function to setup the rest of the scene
	animate(); // render scene to screen and call the animation loop

};
manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
	console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
 };
manager.onError = function ( url ) {
	console.log( 'There was an error loading ' + url );
};

var onProgress = function( xhr,num ) {
	var percentComplete = xhr.loaded / xhr.total * 100;
	console.log( Math.round( percentComplete, 2 ) + '% downloaded' );
};

var onError = function( xhr ) {
	console.error( xhr );
};
//var loader = new THREE.ObjectLoader();
var loader = new THREE.ColladaLoader( manager );
//var loader = new THREE.FBXLoader( manager ); // create a new loader to load collada files and use the download manager
loader.load( myScene.fileToLoad , 
function( object ) {
	console.log(object);
	myScene.scene.add( object.scene ); //object for FBX, object.scene for dae / open collada
	myScene.scene.updateMatrixWorld(); // needs to be called to correctly compute world coords from local

	var loader1 = new THREE.TextureLoader(manager); // Usually it would not be nesseccary to call this loader inside another loader, but becuase colladaLoader does not yet support the loaderManager it breaks the correct way
	for (var i = 0, len = myScene.maps.length; i < len; i++) { // for each texture in the array that needs loading
		myScene.maps[i].path = myScene.texturePath + myScene.maps[i].name + '_' +  myScene.maps[i].type +  myScene.maps[i].format; // create and save the full path to the texture
		myScene.maps[i].image = loader1.load(myScene.maps[i].path); // load the texture in to the object at the position in the array
	}
},onProgress,onError
);

/* ****************  INITIALISE **************** */
function init() {

	
	myView.vpDiv = document.getElementById("vp0"); // assign a div to an object in the myViews array
	myView.setmyViewDimensions (); // calculate the view dimentions for various calculations

	myView.renderer = new THREE.WebGLRenderer({ antialias: true });
	myView.renderer.setClearColor(new THREE.Color(0xEEEEEE));
	myView.renderer.setPixelRatio( 1 );
	myView.renderer.setSize(myView.dimensions.x, myView.dimensions.y);

	myView.vpDiv.appendChild(myView.renderer.domElement);
	

	
	for (var i = 0, len = myScene.maps.length; i < len; i++) { // for each map that exists that needs applying to the scene
		var objectToMap = myScene.scene.getObjectByName(myScene.maps[i].name);// get object from scene that has same name as map
		if (objectToMap) { // if the object exists
			myScene.applyMap (objectToMap,myScene.maps[i]); // Pass the 3dobject and map to function to deal with 
		 }
		 else { // it cant find the object named by the texture
			 console.log ('object: '+ myScene.maps[i].name + 'doesnt exist in the scene');
		 }
	}
	
	if (myScene.camToLoad){ // if a camera name is defined as
		var tempCam = myScene.scene.getObjectByName('cam0'); // load the camera into a temp object
		tempCam.traverse(function (child) { // traverse the whole camera structure to find the actual camera node
			if (child instanceof THREE.PerspectiveCamera) {
				myView.camera = child;
				//myView.camera.applyMatrix (myScene.scene.getObjectByName('cam0').matrix);
				//myView.camera.updateProjectionMatrix();
				// myView.camera.fov = 120;
				myView.camera.rotation.order = "YXZ";
				myView.camera.aspect = (myView.dimensions.x / myView.dimensions.y);
				
			}
		});
	}
	else{
		myView.camera = new THREE.PerspectiveCamera(100, myView.dimensions.x / myView.dimensions.y, 0.1, 100000);
		myView.camera.position.x = 25;myView.camera.position.y = 30;myView.camera.position.z = -25;
		myView.camera.fov = myView.defaultFov; // sets to the defaultFov of 65
	}

	myView.camera.lookAt(new THREE.Vector3(0, 0, 0)); // set the camera to look at the default scene centre
	myView.setCamToOrbitControls (myView.camera.rotation); // set the camera to the orbit controls as declared in the source file. Pass in the camera rotation for look function
	myView.camera.updateProjectionMatrix();
	myScene.scene.add(myView.camera);
	
	var geomClass = new createGeom();
	var geometryToAdd = geomClass.initGeom(); // returns array of objects to add to scene
	geometryToAdd.forEach(function(object){
		myScene.scene.add(object);
	});

	
	/* ------------  Bounding boxes -------------- */
	if (myScene.boundedList){
		for (i=0;i < myScene.boundedList.length;i++){
			var obj = myScene.scene.getObjectByName(myScene.boundedList[i].name);
			obj ? myScene.boundedList[i].name = myScene.calculateBoundingBox(obj,obj.name) : console.log(myScene.boundedList[i].name + ':   :Object for Bounding box cannot be found');
		}
	}
	console.log ('updated bounded list', myScene.boundedList);
	console.log ('scene now looks like ', myScene.scene);

	// postprocessing
	composer = new THREE.EffectComposer( myView.renderer );

	var renderPass = new THREE.RenderPass( myScene.scene, myView.camera );
	composer.addPass( renderPass );

	var outlinePass = new THREE.OutlinePass( new THREE.Vector2(myView.dimensions.x, myView.dimensions.y), myScene.scene, myView.camera);
	outlinePass.edgeStrength = 3.0;
	outlinePass.edgeGlow = 0.0;
	outlinePass.edgeThickness = 2.0;
	outlinePass.pulsePeriod = 3;
	outlinePass.usePatternTexture = true;
	
	outlinePass.visibleEdgeColor.set( '#ffffff' );
	outlinePass.hiddenEdgeColor.set( 'red'  );

	var outlinePassRollover = new THREE.OutlinePass( new THREE.Vector2(myView.dimensions.x, myView.dimensions.y), myScene.scene, myView.camera);
	outlinePassRollover.edgeStrength = 3.0;
	outlinePassRollover.edgeGlow = 0.0;
	outlinePassRollover.edgeThickness = 2.0;
	outlinePassRollover.pulsePeriod = 3;
	outlinePassRollover.usePatternTexture = true;
	
	outlinePassRollover.visibleEdgeColor.set( '#ffffff' );
	outlinePassRollover.hiddenEdgeColor.set( 'green'  );

	var onLoad = function ( texture ) {
		outlinePass.patternTexture = texture;
		outlinePassRollover.patternTexture = texture;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
	};

	var loader = new THREE.TextureLoader();

	// load a resource
	loader.load(
		// resource URL
		'exports/tri_pattern.jpg',
		// Function when resource is loaded
		onLoad
	);

	composer.addPass( outlinePass );
	composer.addPass( outlinePassRollover );

	effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
	effectFXAA.uniforms['resolution'].value.set(1 / myView.dimensions.x, 1 / myView.dimensions.y );
	effectFXAA.renderToScreen = true;
	composer.addPass( effectFXAA );

	var selectedObjects = [];
	function addSelectedObject( object ) {
		
		selectedObjects.push( object );
	}
	var selectedObject = [];
	selectedObject.push (myScene.scene.getObjectByName('bboxGroup_engine')); 
	selectedObject.push (myScene.scene.getObjectByName('bboxGroup_seats')); 
	selectedObject.push (myScene.scene.getObjectByName('bboxGroup_mainBoot')); 

	console.log(selectedObject);
	selectedObject.forEach(outlineTraverse);
	function outlineTraverse(item){
		item.traverse(function (child) {
			var firstPartName = child.name.split('_',1);
			if (child instanceof THREE.Mesh &&  firstPartName != 'bboxMesh'){
				addSelectedObject( child );
			}
		});
	}

	
	outlinePass.selectedObjects = selectedObjects;
	outlinePassRollover.selectedObjects = selectedObjects;  

	heirarchySystem.buildHiearchy(myScene.scene, myScene.boundedList);

}

/* ****************  ANIMATE **************** */
function animate() {
	requestAnimationFrame(animate); // render using requestAnimationFrame
	renderScene();
}
/* ****************  RENDER **************** */
function renderScene() {
	var delta = myScene.clock.getDelta();
	myView.controls.update(delta);
	composer.render();  
}

/* ****************  INPUT **************** */
function mousemove( event ) {
	var intersects = myScene.raycast(event, true);
	if (intersects && intersects[0].object instanceof THREE.BoxHelper ) { // if your mouse moves over a product, mouse buttons not pressed and found a bounding box
		intersects[0].object.traverse(function (child) {
			if (child instanceof THREE.Mesh && !(child instanceof THREE.BoxHelper  )) {
				myScene.setHighlight(child, myScene.hoverColor);
				document.body.style.cursor = 'pointer';
			}
		});
	}
	else {
		myScene.scene.traverse(function (child) {
			if (child instanceof THREE.Mesh && !(child instanceof THREE.BoxHelper  )) {
				//myScene.setHighlight(child, myScene.initialColor);
				document.body.style.cursor = 'initial';
			}
		});
	}        
}

function onResize() {
	myView.setmyViewDimensions ();

	myView.camera.aspect = (myView.dimensions.x / myView.dimensions.y);
	myView.camera.updateProjectionMatrix();
	//myView.renderer.setSize(myView.dimensions.x, myView.dimensions.y);
	//myView.renderer.render( myScene.scene, myView.camera );
	

	myView.renderer.setSize( myView.dimensions.x, myView.dimensions.y );
	composer.setSize( myView.dimensions.x, myView.dimensions.y );
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / myView.dimensions.x, 1 / myView.dimensions.y );

}


window.addEventListener('mousemove',mousemove); 
window.addEventListener('resize', onResize, false);
