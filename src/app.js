/* ==========================================================================
 * HTML5 Genetic Cars - Single-file bundle (no npm/browserify required)
 * Open index.html directly in a browser.
 * ========================================================================== */
(function () {

  /* -------------------------------------------------------------------------
   * machine-learning/random.js
   * ------------------------------------------------------------------------- */


  const random = {
    shuffleIntegers(prop, generator) {
      return random.mapToShuffle(prop, random.createNormals({
        length: prop.length || 10,
        inclusive: true,
      }, generator));
    },
    createIntegers(prop, generator) {
      return random.mapToInteger(prop, random.createNormals({
        length: prop.length,
        inclusive: true,
      }, generator));
    },
    createFloats(prop, generator) {
      return random.mapToFloat(prop, random.createNormals({
        length: prop.length,
        inclusive: true,
      }, generator));
    },
    createNormals(prop, generator) {
      var l = prop.length;
      var values = [];
      for (var i = 0; i < l; i++) {
        values.push(
          createNormal(prop, generator)
        );
      }
      return values;
    },
    mutateShuffle(
      prop, generator, originalValues, mutation_range, chanceToMutate
    ) {
      return random.mapToShuffle(prop, random.mutateNormals(
        prop, generator, originalValues, mutation_range, chanceToMutate
      ));
    },
    mutateIntegers(prop, generator, originalValues, mutation_range, chanceToMutate) {
      return random.mapToInteger(prop, random.mutateNormals(
        prop, generator, originalValues, mutation_range, chanceToMutate
      ));
    },
    mutateFloats(prop, generator, originalValues, mutation_range, chanceToMutate) {
      return random.mapToFloat(prop, random.mutateNormals(
        prop, generator, originalValues, mutation_range, chanceToMutate
      ));
    },
    mapToShuffle(prop, normals) {
      var offset = prop.offset || 0;
      var limit = prop.limit || prop.length;
      var sorted = normals.slice().sort(function (a, b) {
        return a - b;
      });
      return normals.map(function (val) {
        return sorted.indexOf(val);
      }).map(function (i) {
        return i + offset;
      }).slice(0, limit);
    },
    mapToInteger(prop, normals) {
      prop = {
        min: prop.min || 0,
        range: prop.range || 10,
        length: prop.length
      }
      return random.mapToFloat(prop, normals).map(function (float) {
        return Math.round(float);
      });
    },
    mapToFloat(prop, normals) {
      prop = {
        min: prop.min || 0,
        range: prop.range || 1
      }
      return normals.map(function (normal) {
        var min = prop.min;
        var range = prop.range;
        return min + normal * range
      })
    },
    mutateNormals(prop, generator, originalValues, mutation_range, chanceToMutate) {
      var factor = (prop.factor || 1) * mutation_range
      return originalValues.map(function (originalValue) {
        if (generator() > chanceToMutate) {
          return originalValue;
        }
        return mutateNormal(
          prop, generator, originalValue, factor
        );
      });
    }
  };



  function mutateNormal(prop, generator, originalValue, mutation_range) {
    if (mutation_range > 1) {
      throw new Error("Cannot mutate beyond bounds");
    }
    var newMin = originalValue - 0.5;
    if (newMin < 0) newMin = 0;
    if (newMin + mutation_range > 1)
      newMin = 1 - mutation_range;
    var rangeValue = createNormal({
      inclusive: true,
    }, generator);
    return newMin + rangeValue * mutation_range;
  }

  function createNormal(prop, generator) {
    if (!prop.inclusive) {
      return generator();
    } else {
      return generator() < 0.5 ?
        generator() :
        1 - generator();
    }
  }


  /* -------------------------------------------------------------------------
   * machine-learning/create-instance.js
   * ------------------------------------------------------------------------- */


  var createInstance = {
    createGenerationZero(schema, generator) {
      return Object.keys(schema).reduce(function (instance, key) {
        var schemaProp = schema[key];
        var values = random.createNormals(schemaProp, generator);
        instance[key] = values;
        return instance;
      }, { id: Math.random().toString(32) });
    },
    createCrossBreed(schema, parents, parentChooser) {
      var id = Math.random().toString(32);
      return Object.keys(schema).reduce(function (crossDef, key) {
        var schemaDef = schema[key];
        var values = [];
        for (var i = 0, l = schemaDef.length; i < l; i++) {
          var p = parentChooser(id, key, parents);
          values.push(parents[p][key][i]);
        }
        crossDef[key] = values;
        return crossDef;
      }, {
        id: id,
        ancestry: parents.map(function (parent) {
          return {
            id: parent.id,
            ancestry: parent.ancestry,
          };
        })
      });
    },
    createMutatedClone(schema, generator, parent, factor, chanceToMutate) {
      return Object.keys(schema).reduce(function (clone, key) {
        var schemaProp = schema[key];
        var originalValues = parent[key];
        var values = random.mutateNormals(
          schemaProp, generator, originalValues, factor, chanceToMutate
        );
        clone[key] = values;
        return clone;
      }, {
        id: parent.id,
        ancestry: parent.ancestry
      });
    },
    applyTypes(schema, parent) {
      return Object.keys(schema).reduce(function (clone, key) {
        var schemaProp = schema[key];
        var originalValues = parent[key];
        var values;
        switch (schemaProp.type) {
          case "shuffle":
            values = random.mapToShuffle(schemaProp, originalValues); break;
          case "float":
            values = random.mapToFloat(schemaProp, originalValues); break;
          case "integer":
            values = random.mapToInteger(schemaProp, originalValues); break;
          default:
            throw new Error(`Unknown type ${schemaProp.type} of schema for key ${key}`);
        }
        clone[key] = values;
        return clone;
      }, {
        id: parent.id,
        ancestry: parent.ancestry
      });
    },
  }


  /* -------------------------------------------------------------------------
   * car-schema/car-constants.json (inlined)
   * ------------------------------------------------------------------------- */
  var carConstantsData = {
    "wheelCount": 2,
    "wheelMinRadius": 0.2,
    "wheelRadiusRange": 0.5,
    "wheelMinDensity": 40,
    "wheelDensityRange": 100,
    "chassisDensityRange": 300,
    "chassisMinDensity": 30,
    "chassisMinAxis": 0.1,
    "chassisAxisRange": 1.1
  };

  /* -------------------------------------------------------------------------
   * car-schema/construct.js
   * ------------------------------------------------------------------------- */

  var carConstruct = (function () {
    var carConstants = carConstantsData;

    function worldDef() {
      var box2dfps = 60;
      return {
        gravity: { y: 0 }, doSleep: true, floorseed: "abc",
        maxFloorTiles: 200, mutable_floor: false, motorSpeed: 20,
        box2dfps: box2dfps, max_car_health: box2dfps * 10,
        tileDimensions: { width: 1.5, height: 0.15 }
      };
    }
    function getCarConstants() { return carConstants; }
    function generateSchema(values) {
      return {
        wheel_radius: { type: "float", length: values.wheelCount, min: values.wheelMinRadius, range: values.wheelRadiusRange, factor: 1 },
        wheel_density: { type: "float", length: values.wheelCount, min: values.wheelMinDensity, range: values.wheelDensityRange, factor: 1 },
        chassis_density: { type: "float", length: 1, min: values.chassisDensityRange, range: values.chassisMinDensity, factor: 1 },
        vertex_list: { type: "float", length: 12, min: values.chassisMinAxis, range: values.chassisAxisRange, factor: 1 },
        wheel_vertex: { type: "shuffle", length: 8, limit: values.wheelCount, factor: 1 },
      };
    }
    return { worldDef: worldDef, carConstants: getCarConstants, generateSchema: generateSchema };
  })();


  /* -------------------------------------------------------------------------
   * car-schema/def-to-car.js
   * ------------------------------------------------------------------------- */
  /*
    globals b2RevoluteJointDef b2Vec2 b2BodyDef b2Body b2FixtureDef b2PolygonShape b2CircleShape
  */





  function defToCar(normal_def, world, constants) {
    var car_def = createInstance.applyTypes(constants.schema, normal_def)
    var instance = {};
    instance.chassis = createChassis(
      world, car_def.vertex_list, car_def.chassis_density
    );
    var i;

    var wheelCount = car_def.wheel_radius.length;

    instance.wheels = [];
    for (i = 0; i < wheelCount; i++) {
      instance.wheels[i] = createWheel(
        world,
        car_def.wheel_radius[i],
        car_def.wheel_density[i]
      );
    }

    var carmass = instance.chassis.GetMass();
    for (i = 0; i < wheelCount; i++) {
      carmass += instance.wheels[i].GetMass();
    }

    var joint_def = new b2RevoluteJointDef();

    for (i = 0; i < wheelCount; i++) {
      var torque = carmass * -constants.gravity.y / car_def.wheel_radius[i];

      var randvertex = instance.chassis.vertex_list[car_def.wheel_vertex[i]];
      joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
      joint_def.localAnchorB.Set(0, 0);
      joint_def.maxMotorTorque = torque;
      joint_def.motorSpeed = -constants.motorSpeed;
      joint_def.enableMotor = true;
      joint_def.bodyA = instance.chassis;
      joint_def.bodyB = instance.wheels[i];
      world.CreateJoint(joint_def);
    }

    return instance;
  }

  function createChassis(world, vertexs, density) {

    var vertex_list = new Array();
    vertex_list.push(new b2Vec2(vertexs[0], 0));
    vertex_list.push(new b2Vec2(vertexs[1], vertexs[2]));
    vertex_list.push(new b2Vec2(0, vertexs[3]));
    vertex_list.push(new b2Vec2(-vertexs[4], vertexs[5]));
    vertex_list.push(new b2Vec2(-vertexs[6], 0));
    vertex_list.push(new b2Vec2(-vertexs[7], -vertexs[8]));
    vertex_list.push(new b2Vec2(0, -vertexs[9]));
    vertex_list.push(new b2Vec2(vertexs[10], -vertexs[11]));

    var body_def = new b2BodyDef();
    body_def.type = b2Body.b2_dynamicBody;
    body_def.position.Set(0.0, 4.0);

    var body = world.CreateBody(body_def);

    createChassisPart(body, vertex_list[0], vertex_list[1], density);
    createChassisPart(body, vertex_list[1], vertex_list[2], density);
    createChassisPart(body, vertex_list[2], vertex_list[3], density);
    createChassisPart(body, vertex_list[3], vertex_list[4], density);
    createChassisPart(body, vertex_list[4], vertex_list[5], density);
    createChassisPart(body, vertex_list[5], vertex_list[6], density);
    createChassisPart(body, vertex_list[6], vertex_list[7], density);
    createChassisPart(body, vertex_list[7], vertex_list[0], density);

    body.vertex_list = vertex_list;

    return body;
  }


  function createChassisPart(body, vertex1, vertex2, density) {
    var vertex_list = new Array();
    vertex_list.push(vertex1);
    vertex_list.push(vertex2);
    vertex_list.push(b2Vec2.Make(0, 0));
    var fix_def = new b2FixtureDef();
    fix_def.shape = new b2PolygonShape();
    fix_def.density = density;
    fix_def.friction = 10;
    fix_def.restitution = 0.2;
    fix_def.filter.groupIndex = -1;
    fix_def.shape.SetAsArray(vertex_list, 3);

    body.CreateFixture(fix_def);
  }

  function createWheel(world, radius, density) {
    var body_def = new b2BodyDef();
    body_def.type = b2Body.b2_dynamicBody;
    body_def.position.Set(0, 0);

    var body = world.CreateBody(body_def);

    var fix_def = new b2FixtureDef();
    fix_def.shape = new b2CircleShape(radius);
    fix_def.density = density;
    fix_def.friction = 1;
    fix_def.restitution = 0.2;
    fix_def.filter.groupIndex = -1;

    body.CreateFixture(fix_def);
    return body;
  }


  /* -------------------------------------------------------------------------
   * car-schema/run.js
   * ------------------------------------------------------------------------- */


  var carRun = {
    getInitialState: getInitialState,
    updateState: updateState,
    getStatus: getStatus,
    calculateScore: calculateScore,
  };

  function getInitialState(world_def) {
    return {
      frames: 0,
      health: world_def.max_car_health,
      maxPositiony: 0,
      minPositiony: 0,
      maxPositionx: 0,
    };
  }

  function updateState(constants, worldConstruct, state) {
    if (state.health <= 0) {
      throw new Error("Already Dead");
    }
    if (state.maxPositionx > constants.finishLine) {
      throw new Error("already Finished");
    }

    // console.log(state);
    // check health
    var position = worldConstruct.chassis.GetPosition();
    // check if car reached end of the path
    var nextState = {
      frames: state.frames + 1,
      maxPositionx: position.x > state.maxPositionx ? position.x : state.maxPositionx,
      maxPositiony: position.y > state.maxPositiony ? position.y : state.maxPositiony,
      minPositiony: position.y < state.minPositiony ? position.y : state.minPositiony
    };

    if (position.x > constants.finishLine) {
      return nextState;
    }

    if (position.x > state.maxPositionx + 0.02) {
      nextState.health = constants.max_car_health;
      return nextState;
    }
    nextState.health = state.health - 1;
    if (Math.abs(worldConstruct.chassis.GetLinearVelocity().x) < 0.001) {
      nextState.health -= 5;
    }
    return nextState;
  }

  function getStatus(state, constants) {
    if (hasFailed(state, constants)) return -1;
    if (hasSuccess(state, constants)) return 1;
    return 0;
  }

  function hasFailed(state /*, constants */) {
    return state.health <= 0;
  }
  function hasSuccess(state, constants) {
    return state.maxPositionx > constants.finishLine;
  }

  function calculateScore(state, constants) {
    var avgspeed = (state.maxPositionx / state.frames) * constants.box2dfps;
    var position = state.maxPositionx;
    var score = position + avgspeed;
    return {
      v: score,
      s: avgspeed,
      x: position,
      y: state.maxPositiony,
      y2: state.minPositiony
    }
  }


  /* -------------------------------------------------------------------------
   * generation-config/inbreeding-coefficient.js
   * ------------------------------------------------------------------------- */
  // http://sunmingtao.blogspot.com/2016/11/inbreeding-coefficient.html


  function getInbreedingCoefficient(child) {
    var nameIndex = new Map();
    var flagged = new Set();
    var convergencePoints = new Set();
    createAncestryMap(child, []);

    var storedCoefficients = new Map();

    return Array.from(convergencePoints.values()).reduce(function (sum, point) {
      var iCo = getCoefficient(point);
      return sum + iCo;
    }, 0);

    function createAncestryMap(initNode) {
      var itemsInQueue = [{ node: initNode, path: [] }];
      do {
        var item = itemsInQueue.shift();
        var node = item.node;
        var path = item.path;
        if (processItem(node, path)) {
          var nextPath = [node.id].concat(path);
          itemsInQueue = itemsInQueue.concat(node.ancestry.map(function (parent) {
            return {
              node: parent,
              path: nextPath
            };
          }));
        }
      } while (itemsInQueue.length);


      function processItem(node, path) {
        var newAncestor = !nameIndex.has(node.id);
        if (newAncestor) {
          nameIndex.set(node.id, {
            parents: (node.ancestry || []).map(function (parent) {
              return parent.id;
            }),
            id: node.id,
            children: [],
            convergences: [],
          });
        } else {

          flagged.add(node.id)
          nameIndex.get(node.id).children.forEach(function (childIdentifier) {
            var offsets = findConvergence(childIdentifier.path, path);
            if (!offsets) {
              return;
            }
            var childID = path[offsets[1]];
            convergencePoints.add(childID);
            nameIndex.get(childID).convergences.push({
              parent: node.id,
              offsets: offsets,
            });
          });
        }

        if (path.length) {
          nameIndex.get(node.id).children.push({
            child: path[0],
            path: path
          });
        }

        if (!newAncestor) {
          return;
        }
        if (!node.ancestry) {
          return;
        }
        return true;
      }
    }

    function getCoefficient(id) {
      if (storedCoefficients.has(id)) {
        return storedCoefficients.get(id);
      }
      var node = nameIndex.get(id);
      var val = node.convergences.reduce(function (sum, point) {
        return sum + Math.pow(1 / 2, point.offsets.reduce(function (sum, value) {
          return sum + value;
        }, 1)) * (1 + getCoefficient(point.parent));
      }, 0);
      storedCoefficients.set(id, val);

      return val;

    }
    function findConvergence(listA, listB) {
      var ci, cj, li, lj;
      outerloop:
      for (ci = 0, li = listA.length; ci < li; ci++) {
        for (cj = 0, lj = listB.length; cj < lj; cj++) {
          if (listA[ci] === listB[cj]) {
            break outerloop;
          }
        }
      }
      if (ci === li) {
        return false;
      }
      return [ci, cj];
    }
  }


  /* -------------------------------------------------------------------------
   * generation-config/selectFromAllParents.js
   * ------------------------------------------------------------------------- */




  function simpleSelect(parents) {
    var totalParents = parents.length
    var r = Math.random();
    if (r == 0)
      return 0;
    return Math.floor(-Math.log(r) * totalParents) % totalParents;
  }

  function selectFromAllParents(parents, parentList, previousParentIndex) {
    var previousParent = parents[previousParentIndex];
    var validParents = parents.filter(function (parent, i) {
      if (previousParentIndex === i) {
        return false;
      }
      if (!previousParent) {
        return true;
      }
      var child = {
        id: Math.random().toString(32),
        ancestry: [previousParent, parent].map(function (p) {
          return {
            id: p.def.id,
            ancestry: p.def.ancestry
          }
        })
      }
      var iCo = getInbreedingCoefficient(child);
      console.log("inbreeding coefficient", iCo)
      if (iCo > 0.25) {
        return false;
      }
      return true;
    })
    if (validParents.length === 0) {
      return Math.floor(Math.random() * parents.length)
    }
    var totalScore = validParents.reduce(function (sum, parent) {
      return sum + parent.score.v;
    }, 0);
    var r = totalScore * Math.random();
    for (var i = 0; i < validParents.length; i++) {
      var score = validParents[i].score.v;
      if (r > score) {
        r = r - score;
      } else {
        break;
      }
    }
    return i;
  }


  /* -------------------------------------------------------------------------
   * generation-config/pickParent.js
   * ------------------------------------------------------------------------- */
  var nAttributes = 15;


  function pickParent(currentChoices, chooseId, key /* , parents */) {
    if (!currentChoices.has(chooseId)) {
      currentChoices.set(chooseId, initializePick())
    }
    // console.log(chooseId);
    var state = currentChoices.get(chooseId);
    // console.log(state.curparent);
    state.i++
    if (["wheel_radius", "wheel_vertex", "wheel_density"].indexOf(key) > -1) {
      state.curparent = cw_chooseParent(state);
      return state.curparent;
    }
    state.curparent = cw_chooseParent(state);
    return state.curparent;

    function cw_chooseParent(state) {
      var curparent = state.curparent;
      var attributeIndex = state.i;
      var swapPoint1 = state.swapPoint1
      var swapPoint2 = state.swapPoint2
      // console.log(swapPoint1, swapPoint2, attributeIndex)
      if ((swapPoint1 == attributeIndex) || (swapPoint2 == attributeIndex)) {
        return curparent == 1 ? 0 : 1
      }
      return curparent
    }

    function initializePick() {
      var curparent = 0;

      var swapPoint1 = Math.floor(Math.random() * (nAttributes));
      var swapPoint2 = swapPoint1;
      while (swapPoint2 == swapPoint1) {
        swapPoint2 = Math.floor(Math.random() * (nAttributes));
      }
      var i = 0;
      return {
        curparent: curparent,
        i: i,
        swapPoint1: swapPoint1,
        swapPoint2: swapPoint2
      }
    }
  }


  /* -------------------------------------------------------------------------
   * generation-config/generateRandom.js
   * ------------------------------------------------------------------------- */


  function generateRandom() {
    return Math.random();
  }


  /* -------------------------------------------------------------------------
   * generation-config/index.js
   * ------------------------------------------------------------------------- */

  var generationConfig = (function () {
    var carConstants = carConstruct.carConstants();
    var schema = carConstruct.generateSchema(carConstants);
    var constants = {
      generationSize: 20, schema: schema, championLength: 1,
      mutation_range: 1, gen_mutation: 0.05,
    };
    var fn = function () {
      var currentChoices = new Map();
      return Object.assign({}, constants, {
        selectFromAllParents: simpleSelect,
        generateRandom: generateRandom,
        pickParent: pickParent.bind(void 0, currentChoices),
      });
    };
    fn.constants = constants;
    return fn;
  })();


  /* -------------------------------------------------------------------------
   * machine-learning/genetic-algorithm/manage-round.js
   * ------------------------------------------------------------------------- */
  var manageRound = (function () {
    var create = createInstance;



    function generationZero(config) {
      var generationSize = config.generationSize,
        schema = config.schema;
      var cw_carGeneration = [];
      for (var k = 0; k < generationSize; k++) {
        var def = create.createGenerationZero(schema, function () {
          return Math.random()
        });
        def.index = k;
        cw_carGeneration.push(def);
      }
      return {
        counter: 0,
        generation: cw_carGeneration,
      };
    }

    function nextGeneration(
      previousState,
      scores,
      config
    ) {
      var champion_length = config.championLength,
        generationSize = config.generationSize,
        selectFromAllParents = config.selectFromAllParents;

      var newGeneration = new Array();
      var newborn;
      for (var k = 0; k < champion_length; k++) {
        ``
        scores[k].def.is_elite = true;
        scores[k].def.index = k;
        newGeneration.push(scores[k].def);
      }
      var parentList = [];
      for (k = champion_length; k < generationSize; k++) {
        var parent1 = selectFromAllParents(scores, parentList);
        var parent2 = parent1;
        while (parent2 == parent1) {
          parent2 = selectFromAllParents(scores, parentList, parent1);
        }
        var pair = [parent1, parent2]
        parentList.push(pair);
        newborn = makeChild(config,
          pair.map(function (parent) { return scores[parent].def; })
        );
        newborn = mutate(config, newborn);
        newborn.is_elite = false;
        newborn.index = k;
        newGeneration.push(newborn);
      }

      return {
        counter: previousState.counter + 1,
        generation: newGeneration,
      };
    }


    function makeChild(config, parents) {
      var schema = config.schema,
        pickParent = config.pickParent;
      return create.createCrossBreed(schema, parents, pickParent)
    }


    function mutate(config, parent) {
      var schema = config.schema,
        mutation_range = config.mutation_range,
        gen_mutation = config.gen_mutation,
        generateRandom = config.generateRandom;
      return create.createMutatedClone(
        schema,
        generateRandom,
        parent,
        Math.max(mutation_range),
        gen_mutation
      )
    }

    return { generationZero: generationZero, nextGeneration: nextGeneration };
  })();


  /* -------------------------------------------------------------------------
   * machine-learning/simulated-annealing/manage-round.js
   * ------------------------------------------------------------------------- */
  var manageRoundSA = (function () {
    var create = createInstance;



    function generationZero(config) {
      var oldStructure = create.createGenerationZero(
        config.schema, config.generateRandom
      );
      var newStructure = createStructure(config, 1, oldStructure);

      var k = 0;

      return {
        counter: 0,
        k: k,
        generation: [newStructure, oldStructure]
      }
    }

    function nextGeneration(previousState, scores, config) {
      var nextState = {
        k: (previousState.k + 1) % config.generationSize,
        counter: previousState.counter + (previousState.k === config.generationSize ? 1 : 0)
      };
      // gradually get closer to zero temperature (but never hit it)
      var oldDef = previousState.curDef || previousState.generation[1];
      var oldScore = previousState.score || scores[1].score.v;

      var newDef = previousState.generation[0];
      var newScore = scores[0].score.v;


      var temp = Math.pow(Math.E, -nextState.counter / config.generationSize);

      var scoreDiff = newScore - oldScore;
      // If the next point is higher, change location
      if (scoreDiff > 0) {
        nextState.curDef = newDef;
        nextState.score = newScore;
        // Else we want to increase likelyhood of changing location as we get
      } else if (Math.random() > Math.exp(-scoreDiff / (nextState.k * temp))) {
        nextState.curDef = newDef;
        nextState.score = newScore;
      } else {
        nextState.curDef = oldDef;
        nextState.score = oldScore;
      }

      console.log(previousState, nextState);

      nextState.generation = [createStructure(config, temp, nextState.curDef)];

      return nextState;
    }


    function createStructure(config, mutation_range, parent) {
      var schema = config.schema,
        gen_mutation = 1,
        generateRandom = config.generateRandom;
      return create.createMutatedClone(
        schema,
        generateRandom,
        parent,
        mutation_range,
        gen_mutation
      )

    }

    return { generationZero: generationZero, nextGeneration: nextGeneration };
  })();


  /* -------------------------------------------------------------------------
   * ghost/car-to-ghost.js
   * ------------------------------------------------------------------------- */

  function ghost_get_frame(car) {
    var out = {
      chassis: ghost_get_chassis(car.chassis),
      wheels: [],
      pos: { x: car.chassis.GetPosition().x, y: car.chassis.GetPosition().y }
    };

    for (var i = 0; i < car.wheels.length; i++) {
      out.wheels[i] = ghost_get_wheel(car.wheels[i]);
    }

    return out;
  }

  function ghost_get_chassis(c) {
    var gc = [];

    for (var f = c.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();

      var p = {
        vtx: [],
        num: 0
      }

      p.num = s.m_vertexCount;

      for (var i = 0; i < s.m_vertexCount; i++) {
        p.vtx.push(c.GetWorldPoint(s.m_vertices[i]));
      }

      gc.push(p);
    }

    return gc;
  }

  function ghost_get_wheel(w) {
    var gw = [];

    for (var f = w.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();

      var c = {
        pos: w.GetWorldPoint(s.m_p),
        rad: s.m_radius,
        ang: w.m_sweep.a
      }

      gw.push(c);
    }

    return gw;
  }


  /* -------------------------------------------------------------------------
   * ghost/index.js
   * ------------------------------------------------------------------------- */
  var ghost_fns = (function () {
    var enable_ghost = true;







    function ghost_create_replay() {
      if (!enable_ghost)
        return null;

      return {
        num_frames: 0,
        frames: [],
      }
    }

    function ghost_create_ghost() {
      if (!enable_ghost)
        return null;

      return {
        replay: null,
        frame: 0,
        dist: -100
      }
    }

    function ghost_reset_ghost(ghost) {
      if (!enable_ghost)
        return;
      if (ghost == null)
        return;
      ghost.frame = 0;
    }

    function ghost_pause(ghost) {
      if (ghost != null)
        ghost.old_frame = ghost.frame;
      ghost_reset_ghost(ghost);
    }

    function ghost_resume(ghost) {
      if (ghost != null)
        ghost.frame = ghost.old_frame;
    }

    function ghost_get_position(ghost) {
      if (!enable_ghost)
        return;
      if (ghost == null)
        return;
      if (ghost.frame < 0)
        return;
      if (ghost.replay == null)
        return;
      var frame = ghost.replay.frames[ghost.frame];
      if (!frame) return;
      return frame.pos;
    }

    function ghost_compare_to_replay(replay, ghost, max) {
      if (!enable_ghost)
        return;
      if (ghost == null)
        return;
      if (replay == null)
        return;

      if (ghost.dist < max) {
        ghost.replay = replay;
        ghost.dist = max;
        ghost.frame = 0;
      }
    }

    function ghost_move_frame(ghost) {
      if (!enable_ghost)
        return;
      if (ghost == null)
        return;
      if (ghost.replay == null)
        return;
      ghost.frame++;
      if (ghost.frame >= ghost.replay.num_frames)
        ghost.frame = ghost.replay.num_frames - 1;
    }

    function ghost_add_replay_frame(replay, car) {
      if (!enable_ghost)
        return;
      if (replay == null)
        return;

      var frame = ghost_get_frame(car);
      replay.frames.push(frame);
      replay.num_frames++;
    }

    function ghost_draw_frame(ctx, ghost, camera) {
      var zoom = camera.zoom;
      if (!enable_ghost)
        return;
      if (ghost == null)
        return;
      if (ghost.frame < 0)
        return;
      if (ghost.replay == null)
        return;

      var frame = ghost.replay.frames[ghost.frame];
      if (!frame) return;

      // wheel style
      ctx.fillStyle = "#eee";
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1 / zoom;

      for (var i = 0; i < frame.wheels.length; i++) {
        for (var w in frame.wheels[i]) {
          ghost_draw_circle(ctx, frame.wheels[i][w].pos, frame.wheels[i][w].rad, frame.wheels[i][w].ang);
        }
      }

      // chassis style
      ctx.strokeStyle = "#aaa";
      ctx.fillStyle = "#eee";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (var c in frame.chassis)
        ghost_draw_poly(ctx, frame.chassis[c].vtx, frame.chassis[c].num);
      ctx.fill();
      ctx.stroke();
    }

    function ghost_draw_poly(ctx, vtx, n_vtx) {
      ctx.moveTo(vtx[0].x, vtx[0].y);
      for (var i = 1; i < n_vtx; i++) {
        ctx.lineTo(vtx[i].x, vtx[i].y);
      }
      ctx.lineTo(vtx[0].x, vtx[0].y);
    }

    function ghost_draw_circle(ctx, center, radius, angle) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI, true);

      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));

      ctx.fill();
      ctx.stroke();
    }

    return {
      ghost_create_replay: ghost_create_replay, ghost_create_ghost: ghost_create_ghost,
      ghost_pause: ghost_pause, ghost_resume: ghost_resume,
      ghost_get_position: ghost_get_position, ghost_compare_to_replay: ghost_compare_to_replay,
      ghost_move_frame: ghost_move_frame, ghost_add_replay_frame: ghost_add_replay_frame,
      ghost_draw_frame: ghost_draw_frame, ghost_reset_ghost: ghost_reset_ghost
    };
  })();


  /* -------------------------------------------------------------------------
   * draw/draw-virtual-poly.js
   * ------------------------------------------------------------------------- */


  function cw_drawVirtualPoly(ctx, body, vtx, n_vtx) {
    // set strokestyle and fillstyle before call
    // call beginPath before call

    var p0 = body.GetWorldPoint(vtx[0]);
    ctx.moveTo(p0.x, p0.y);
    for (var i = 1; i < n_vtx; i++) {
      var p = body.GetWorldPoint(vtx[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(p0.x, p0.y);
  }


  /* -------------------------------------------------------------------------
   * draw/draw-circle.js
   * ------------------------------------------------------------------------- */



  function cw_drawCircle(ctx, body, center, radius, angle, color) {
    var p = body.GetWorldPoint(center);
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, true);

    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/draw-floor.js
   * ------------------------------------------------------------------------- */

  function cw_drawFloor(ctx, camera, cw_floorTiles) {
    var camera_x = camera.pos.x;
    var zoom = camera.zoom;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#777";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();

    var k;
    if (camera.pos.x - 10 > 0) {
      k = Math.floor((camera.pos.x - 10) / 1.5);
    } else {
      k = 0;
    }

    // console.log(k);

    outer_loop:
    for (k; k < cw_floorTiles.length; k++) {
      var b = cw_floorTiles[k];
      for (var f = b.GetFixtureList(); f; f = f.m_next) {
        var s = f.GetShape();
        var shapePosition = b.GetWorldPoint(s.m_vertices[0]).x;
        if ((shapePosition > (camera_x - 5)) && (shapePosition < (camera_x + 10))) {
          cw_drawVirtualPoly(ctx, b, s.m_vertices, s.m_vertexCount);
        }
        if (shapePosition > camera_x + 10) {
          break outer_loop;
        }
      }
    }
    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/scatter-plot.js
   * ------------------------------------------------------------------------- */


  // Called when the Visualization API is loaded.


  function scatterPlot(elem, scores) {
    var keys = Object.keys(scores[0].def);
    keys = keys.reduce(function (curArray, key) {
      var l = scores[0].def[key].length;
      var subArray = [];
      for (var i = 0; i < l; i++) {
        subArray.push(key + "." + i);
      }
      return curArray.concat(subArray);
    }, []);
    function retrieveValue(obj, path) {
      return path.split(".").reduce(function (curValue, key) {
        return curValue[key];
      }, obj);
    }

    var dataObj = Object.keys(scores).reduce(function (kv, score) {
      keys.forEach(function (key) {
        kv[key].data.push([
          retrieveValue(score.def, key), score.score.v
        ])
      })
      return kv;
    }, keys.reduce(function (kv, key) {
      kv[key] = {
        name: key,
        data: [],
      }
      return kv;
    }, {}))
    Highcharts.chart(elem.id, {
      chart: {
        type: 'scatter',
        zoomType: 'xy'
      },
      title: {
        text: 'Property Value to Score'
      },
      xAxis: {
        title: {
          enabled: true,
          text: 'Normalized'
        },
        startOnTick: true,
        endOnTick: true,
        showLastLabel: true
      },
      yAxis: {
        title: {
          text: 'Score'
        }
      },
      legend: {
        layout: 'vertical',
        align: 'left',
        verticalAlign: 'top',
        x: 100,
        y: 70,
        floating: true,
        backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF',
        borderWidth: 1
      },
      plotOptions: {
        scatter: {
          marker: {
            radius: 5,
            states: {
              hover: {
                enabled: true,
                lineColor: 'rgb(100,100,100)'
              }
            }
          },
          states: {
            hover: {
              marker: {
                enabled: false
              }
            }
          },
          tooltip: {
            headerFormat: '<b>{series.name}</b><br>',
            pointFormat: '{point.x}, {point.y}'
          }
        }
      },
      series: keys.map(function (key) {
        return dataObj[key];
      })
    });
  }

  function visChart(elem, scores, propertyMap, graph) {

    // Create and populate a data table.
    var data = new vis.DataSet();
    scores.forEach(function (scoreInfo) {
      data.add({
        x: getProperty(scoreInfo, propertyMap.x),
        y: getProperty(scoreInfo, propertyMap.x),
        z: getProperty(scoreInfo, propertyMap.z),
        style: getProperty(scoreInfo, propertyMap.z),
        // extra: def.ancestry
      });
    });

    function getProperty(info, key) {
      if (key === "score") {
        return info.score.v
      } else {
        return info.def[key];
      }
    }

    // specify options
    var options = {
      width: '600px',
      height: '600px',
      style: 'dot-size',
      showPerspective: true,
      showLegend: true,
      showGrid: true,
      showShadow: false,

      // Option tooltip can be true, false, or a function returning a string with HTML contents
      tooltip: function (point) {
        // parameter point contains properties x, y, z, and data
        // data is the original object passed to the point constructor
        return 'score: <b>' + point.z + '</b><br>'; // + point.data.extra;
      },

      // Tooltip default styling can be overridden
      tooltipStyle: {
        content: {
          background: 'rgba(255, 255, 255, 0.7)',
          padding: '10px',
          borderRadius: '10px'
        },
        line: {
          borderLeft: '1px dotted rgba(0, 0, 0, 0.5)'
        },
        dot: {
          border: '5px solid rgba(0, 0, 0, 0.5)'
        }
      },

      keepAspectRatio: true,
      verticalRatio: 0.5
    };

    var camera = graph ? graph.getCameraPosition() : null;

    // create our graph
    var container = elem;
    graph = new vis.Graph3d(container, data, options);

    if (camera) graph.setCameraPosition(camera); // restore camera position
    return graph;
  }


  /* -------------------------------------------------------------------------
   * draw/plot-graphs.js
   * ------------------------------------------------------------------------- */


  var graph_fns = {
    plotGraphs: function (graphElem, topScoresElem, scatterPlotElem, lastState, scores, config) {
      lastState = lastState || {};
      var generationSize = scores.length
      var graphcanvas = graphElem;
      var graphctx = graphcanvas.getContext("2d");
      var graphwidth = 400;
      var graphheight = 250;
      var nextState = cw_storeGraphScores(
        lastState, scores, generationSize
      );
      console.log(scores, nextState);
      cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
      cw_plotAverage(nextState, graphctx);
      cw_plotElite(nextState, graphctx);
      cw_plotTop(nextState, graphctx);
      cw_listTopScores(topScoresElem, nextState);
      nextState.scatterGraph = drawAllResults(
        scatterPlotElem, config, nextState, lastState.scatterGraph
      );
      return nextState;
    },
    clearGraphics: function (graphElem) {
      var graphcanvas = graphElem;
      var graphctx = graphcanvas.getContext("2d");
      var graphwidth = 400;
      var graphheight = 250;
      cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight);
    }
  };


  function cw_storeGraphScores(lastState, cw_carScores, generationSize) {
    console.log(cw_carScores);
    return {
      cw_topScores: (lastState.cw_topScores || [])
        .concat([cw_carScores[0].score]),
      cw_graphAverage: (lastState.cw_graphAverage || []).concat([
        cw_average(cw_carScores, generationSize)
      ]),
      cw_graphElite: (lastState.cw_graphElite || []).concat([
        cw_eliteaverage(cw_carScores, generationSize)
      ]),
      cw_graphTop: (lastState.cw_graphTop || []).concat([
        cw_carScores[0].score.v
      ]),
      allResults: (lastState.allResults || []).concat(cw_carScores),
    }
  }

  function cw_plotTop(state, graphctx) {
    var cw_graphTop = state.cw_graphTop;
    var graphsize = cw_graphTop.length;
    graphctx.strokeStyle = "#C83B3B";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (var k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphTop[k]);
    }
    graphctx.stroke();
  }

  function cw_plotElite(state, graphctx) {
    var cw_graphElite = state.cw_graphElite;
    var graphsize = cw_graphElite.length;
    graphctx.strokeStyle = "#7BC74D";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (var k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphElite[k]);
    }
    graphctx.stroke();
  }

  function cw_plotAverage(state, graphctx) {
    var cw_graphAverage = state.cw_graphAverage;
    var graphsize = cw_graphAverage.length;
    graphctx.strokeStyle = "#3F72AF";
    graphctx.beginPath();
    graphctx.moveTo(0, 0);
    for (var k = 0; k < graphsize; k++) {
      graphctx.lineTo(400 * (k + 1) / graphsize, cw_graphAverage[k]);
    }
    graphctx.stroke();
  }


  function cw_eliteaverage(scores, generationSize) {
    var sum = 0;
    for (var k = 0; k < Math.floor(generationSize / 2); k++) {
      sum += scores[k].score.v;
    }
    return sum / Math.floor(generationSize / 2);
  }

  function cw_average(scores, generationSize) {
    var sum = 0;
    for (var k = 0; k < generationSize; k++) {
      sum += scores[k].score.v;
    }
    return sum / generationSize;
  }

  function cw_clearGraphics(graphcanvas, graphctx, graphwidth, graphheight) {
    graphcanvas.width = graphcanvas.width;
    graphctx.translate(0, graphheight);
    graphctx.scale(1, -1);
    graphctx.lineWidth = 1;
    graphctx.strokeStyle = "#3F72AF";
    graphctx.beginPath();
    graphctx.moveTo(0, graphheight / 2);
    graphctx.lineTo(graphwidth, graphheight / 2);
    graphctx.moveTo(0, graphheight / 4);
    graphctx.lineTo(graphwidth, graphheight / 4);
    graphctx.moveTo(0, graphheight * 3 / 4);
    graphctx.lineTo(graphwidth, graphheight * 3 / 4);
    graphctx.stroke();
  }

  function cw_listTopScores(elem, state) {
    var cw_topScores = state.cw_topScores;
    var ts = elem;
    ts.innerHTML = "<b>Top Scores:</b><br />";
    cw_topScores.sort(function (a, b) {
      if (a.v > b.v) {
        return -1
      } else {
        return 1
      }
    });

    for (var k = 0; k < Math.min(10, cw_topScores.length); k++) {
      var topScore = cw_topScores[k];
      // console.log(topScore);
      var n = "#" + (k + 1) + ":";
      var score = Math.round(topScore.v * 100) / 100;
      var distance = "d:" + Math.round(topScore.x * 100) / 100;
      var yrange = "h:" + Math.round(topScore.y2 * 100) / 100 + "/" + Math.round(topScore.y * 100) / 100 + "m";
      var gen = "(Gen " + cw_topScores[k].i + ")"

      ts.innerHTML += [n, score, distance, yrange, gen].join(" ") + "<br />";
    }
  }

  function drawAllResults(scatterPlotElem, config, allResults, previousGraph) {
    if (!scatterPlotElem) return;
    return scatterPlot(scatterPlotElem, allResults, config.propertyMap, previousGraph)
  }


  /* -------------------------------------------------------------------------
   * draw/draw-car.js
   * ------------------------------------------------------------------------- */




  function drawCar(car_constants, myCar, camera, ctx) {
    var camera_x = camera.pos.x;
    var zoom = camera.zoom;

    var wheelMinDensity = car_constants.wheelMinDensity
    var wheelDensityRange = car_constants.wheelDensityRange

    if (!myCar.alive) {
      return;
    }
    var myCarPos = myCar.getPosition();

    if (myCarPos.x < (camera_x - 5)) {
      // too far behind, don't draw
      return;
    }

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1 / zoom;

    var wheels = myCar.car.car.wheels;

    for (var i = 0; i < wheels.length; i++) {
      var b = wheels[i];
      for (var f = b.GetFixtureList(); f; f = f.m_next) {
        var s = f.GetShape();
        var color = Math.round(255 - (255 * (f.m_density - wheelMinDensity)) / wheelDensityRange).toString();
        var rgbcolor = "rgb(" + color + "," + color + "," + color + ")";
        cw_drawCircle(ctx, b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
      }
    }

    if (myCar.is_elite) {
      ctx.strokeStyle = "#3F72AF";
      ctx.fillStyle = "#DBE2EF";
    } else {
      ctx.strokeStyle = "#F7C873";
      ctx.fillStyle = "#FAEBCD";
    }
    ctx.beginPath();

    var chassis = myCar.car.car.chassis;

    for (f = chassis.GetFixtureList(); f; f = f.m_next) {
      var cs = f.GetShape();
      cw_drawVirtualPoly(ctx, chassis, cs.m_vertices, cs.m_vertexCount);
    }
    ctx.fill();
    ctx.stroke();
  }


  /* -------------------------------------------------------------------------
   * draw/draw-car-stats.js
   * ------------------------------------------------------------------------- */


  var run = carRun;

  /* ========================================================================= */
  /* === Car ================================================================= */
  var cw_Car = function () {
    this.__constructor.apply(this, arguments);
  }

  cw_Car.prototype.__constructor = function (car) {
    this.car = car;
    this.car_def = car.def;
    var car_def = this.car_def;

    this.frames = 0;
    this.alive = true;
    this.is_elite = car.def.is_elite;
    this.healthBar = document.getElementById("health" + car_def.index).style;
    this.healthBarText = document.getElementById("health" + car_def.index).nextSibling.nextSibling;
    this.healthBarText.innerHTML = car_def.index;
    this.minimapmarker = document.getElementById("bar" + car_def.index);

    if (this.is_elite) {
      this.healthBar.backgroundColor = "#3F72AF";
      this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
      this.minimapmarker.innerHTML = car_def.index;
    } else {
      this.healthBar.backgroundColor = "#F7C873";
      this.minimapmarker.style.borderLeft = "1px solid #F7C873";
      this.minimapmarker.innerHTML = car_def.index;
    }

  }

  cw_Car.prototype.getPosition = function () {
    return this.car.car.chassis.GetPosition();
  }

  cw_Car.prototype.kill = function (currentRunner, constants) {
    this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
    var finishLine = currentRunner.scene.finishLine
    var max_car_health = constants.max_car_health;
    var status = run.getStatus(this.car.state, {
      finishLine: finishLine,
      max_car_health: max_car_health,
    })
    switch (status) {
      case 1: {
        this.healthBar.width = "0";
        break
      }
      case -1: {
        this.healthBarText.innerHTML = "&dagger;";
        this.healthBar.width = "0";
        break
      }
    }
    this.alive = false;

  }




  /* -------------------------------------------------------------------------
   * world/setup-scene.js
   * ------------------------------------------------------------------------- */


  /*
  
  world_def = {
    gravity: {x, y},
    doSleep: boolean,
    floorseed: string,
    tileDimensions,
    maxFloorTiles,
    mutable_floor: boolean
  }
  
  */

  function setupScene(world_def) {

    var world = new b2World(world_def.gravity, world_def.doSleep);
    var floorTiles = cw_createFloor(
      world,
      world_def.floorseed,
      world_def.tileDimensions,
      world_def.maxFloorTiles,
      world_def.mutable_floor
    );

    var last_tile = floorTiles[
      floorTiles.length - 1
    ];
    var last_fixture = last_tile.GetFixtureList();
    var tile_position = last_tile.GetWorldPoint(
      last_fixture.GetShape().m_vertices[3]
    );
    world.finishLine = tile_position.x;
    return {
      world: world,
      floorTiles: floorTiles,
      finishLine: tile_position.x
    };
  }

  function cw_createFloor(world, floorseed, dimensions, maxFloorTiles, mutable_floor) {
    var last_tile = null;
    var tile_position = new b2Vec2(-5, 0);
    var cw_floorTiles = [];
    Math.seedrandom(floorseed);
    for (var k = 0; k < maxFloorTiles; k++) {
      if (!mutable_floor) {
        // keep old impossible tracks if not using mutable floors
        last_tile = cw_createFloorTile(
          world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.5 * k / maxFloorTiles
        );
      } else {
        // if path is mutable over races, create smoother tracks
        last_tile = cw_createFloorTile(
          world, dimensions, tile_position, (Math.random() * 3 - 1.5) * 1.2 * k / maxFloorTiles
        );
      }
      cw_floorTiles.push(last_tile);
      var last_fixture = last_tile.GetFixtureList();
      tile_position = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
    }
    return cw_floorTiles;
  }


  function cw_createFloorTile(world, dim, position, angle) {
    var body_def = new b2BodyDef();

    body_def.position.Set(position.x, position.y);
    var body = world.CreateBody(body_def);
    var fix_def = new b2FixtureDef();
    fix_def.shape = new b2PolygonShape();
    fix_def.friction = 0.5;

    var coords = new Array();
    coords.push(new b2Vec2(0, 0));
    coords.push(new b2Vec2(0, -dim.y));
    coords.push(new b2Vec2(dim.x, -dim.y));
    coords.push(new b2Vec2(dim.x, 0));

    var center = new b2Vec2(0, 0);

    var newcoords = cw_rotateFloorTile(coords, center, angle);

    fix_def.shape.SetAsArray(newcoords);

    body.CreateFixture(fix_def);
    return body;
  }

  function cw_rotateFloorTile(coords, center, angle) {
    return coords.map(function (coord) {
      return {
        x: Math.cos(angle) * (coord.x - center.x) - Math.sin(angle) * (coord.y - center.y) + center.x,
        y: Math.sin(angle) * (coord.x - center.x) + Math.cos(angle) * (coord.y - center.y) + center.y,
      };
    });
  }


  /* -------------------------------------------------------------------------
   * world/run.js
   * ------------------------------------------------------------------------- */
  function worldRun(world_def, defs, listeners) {
    if (world_def.mutable_floor) {
      // GHOST DISABLED
      world_def.floorseed = btoa(Math.seedrandom());
    }

    var scene = setupScene(world_def);
    scene.world.Step(1 / world_def.box2dfps, 20, 20);
    console.log("about to build cars");
    var cars = defs.map((def, i) => {
      return {
        index: i,
        def: def,
        car: defToCar(def, scene.world, world_def),
        state: carRun.getInitialState(world_def)
      };
    });
    var alivecars = cars;
    return {
      scene: scene,
      cars: cars,
      step: function () {
        if (alivecars.length === 0) {
          throw new Error("no more cars");
        }
        scene.world.Step(1 / world_def.box2dfps, 20, 20);
        listeners.preCarStep();
        alivecars = alivecars.filter(function (car) {
          car.state = carRun.updateState(
            world_def, car.car, car.state
          );
          var status = carRun.getStatus(car.state, world_def);
          listeners.carStep(car);
          if (status === 0) {
            return true;
          }
          car.score = carRun.calculateScore(car.state, world_def);
          listeners.carDeath(car);

          var world = scene.world;
          var worldCar = car.car;
          world.DestroyBody(worldCar.chassis);

          for (var w = 0; w < worldCar.wheels.length; w++) {
            world.DestroyBody(worldCar.wheels[w]);
          }

          return false;
        })
        if (alivecars.length === 0) {
          listeners.generationEnd(cars);
        }
      }
    }

  }


  /* -------------------------------------------------------------------------
   * index.js (main entry)
   * ------------------------------------------------------------------------- */
  // Global Vars




  var plot_graphs = graph_fns.plotGraphs;

  var ghost_draw_frame = ghost_fns.ghost_draw_frame;
  var ghost_create_ghost = ghost_fns.ghost_create_ghost;
  var ghost_add_replay_frame = ghost_fns.ghost_add_replay_frame;
  var ghost_compare_to_replay = ghost_fns.ghost_compare_to_replay;
  var ghost_get_position = ghost_fns.ghost_get_position;
  var ghost_move_frame = ghost_fns.ghost_move_frame;
  var ghost_reset_ghost = ghost_fns.ghost_reset_ghost
  var ghost_pause = ghost_fns.ghost_pause;
  var ghost_resume = ghost_fns.ghost_resume;
  var ghost_create_replay = ghost_fns.ghost_create_replay;

  var ghost;
  var carMap = new Map();

  var doDraw = true;
  var cw_paused = false;

  var box2dfps = 60;
  var screenfps = 60;
  var skipTicks = Math.round(1000 / box2dfps);
  var maxFrameSkip = skipTicks * 2;

  var canvas = document.getElementById("mainbox");
  var ctx = canvas.getContext("2d");

  var camera = {
    speed: 0.05,
    pos: {
      x: 0, y: 0
    },
    target: -1,
    zoom: 70
  }

  var minimapcamera = document.getElementById("minimapcamera").style;
  var minimapholder = document.querySelector("#minimapholder");

  var minimapcanvas = document.getElementById("minimap");
  var minimapctx = minimapcanvas.getContext("2d");
  var minimapscale = 3;
  var minimapfogdistance = 0;
  var fogdistance = document.getElementById("minimapfog").style;


  var carConstants = carConstruct.carConstants();


  var max_car_health = box2dfps * 10;

  var cw_ghostReplayInterval = null;

  var distanceMeter = document.getElementById("distancemeter");
  var heightMeter = document.getElementById("heightmeter");

  var leaderPosition = {
    x: 0, y: 0
  }

  minimapcamera.width = 12 * minimapscale + "px";
  minimapcamera.height = 6 * minimapscale + "px";


  // ======= WORLD STATE ======


  var world_def = {
    gravity: new b2Vec2(0.0, -9.81),
    doSleep: true,
    floorseed: btoa(Math.seedrandom()),
    tileDimensions: new b2Vec2(1.5, 0.15),
    maxFloorTiles: 200,
    mutable_floor: false,
    box2dfps: box2dfps,
    motorSpeed: 20,
    max_car_health: max_car_health,
    schema: generationConfig.constants.schema
  }

  var cw_deadCars;
  var graphState = {
    cw_topScores: [],
    cw_graphAverage: [],
    cw_graphElite: [],
    cw_graphTop: [],
  };

  function resetGraphState() {
    graphState = {
      cw_topScores: [],
      cw_graphAverage: [],
      cw_graphElite: [],
      cw_graphTop: [],
    };
  }



  // ==========================

  var generationState;

  // ======== Activity State ====
  var currentRunner;
  var loops = 0;
  var nextGameTick = (new Date).getTime();

  function showDistance(distance, height) {
    distanceMeter.innerHTML = distance + " meters<br />";
    heightMeter.innerHTML = height + " meters";
    if (distance > minimapfogdistance) {
      fogdistance.width = 800 - Math.round(distance + 15) * minimapscale + "px";
      minimapfogdistance = distance;
    }
  }



  /* === END Car ============================================================= */
  /* ========================================================================= */


  /* ========================================================================= */
  /* ==== Generation ========================================================= */

  function cw_generationZero() {

    generationState = manageRound.generationZero(generationConfig());
  }

  function resetCarUI() {
    cw_deadCars = 0;
    leaderPosition = {
      x: 0, y: 0
    };
    document.getElementById("generation").innerHTML = generationState.counter.toString();
    document.getElementById("cars").innerHTML = "";
    document.getElementById("population").innerHTML = generationConfig.constants.generationSize.toString();
  }

  /* ==== END Genration ====================================================== */
  /* ========================================================================= */

  /* ========================================================================= */
  /* ==== Drawing ============================================================ */

  function cw_drawScreen() {
    var floorTiles = currentRunner.scene.floorTiles;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    cw_setCameraPosition();
    var camera_x = camera.pos.x;
    var camera_y = camera.pos.y;
    var zoom = camera.zoom;
    ctx.translate(200 - (camera_x * zoom), 200 + (camera_y * zoom));
    ctx.scale(zoom, -zoom);
    cw_drawFloor(ctx, camera, floorTiles);
    ghost_draw_frame(ctx, ghost, camera);
    cw_drawCars();
    ctx.restore();
  }

  function cw_minimapCamera(/* x, y*/) {
    var camera_x = camera.pos.x
    var camera_y = camera.pos.y
    minimapcamera.left = Math.round((2 + camera_x) * minimapscale) + "px";
    minimapcamera.top = Math.round((31 - camera_y) * minimapscale) + "px";
  }

  function cw_setCameraTarget(k) {
    camera.target = k;
  }

  function cw_setCameraPosition() {
    var cameraTargetPosition
    if (camera.target !== -1) {
      cameraTargetPosition = carMap.get(camera.target).getPosition();
    } else {
      cameraTargetPosition = leaderPosition;
    }
    var diff_y = camera.pos.y - cameraTargetPosition.y;
    var diff_x = camera.pos.x - cameraTargetPosition.x;
    camera.pos.y -= camera.speed * diff_y;
    camera.pos.x -= camera.speed * diff_x;
    cw_minimapCamera(camera.pos.x, camera.pos.y);
  }

  function cw_drawGhostReplay() {
    var floorTiles = currentRunner.scene.floorTiles;
    var carPosition = ghost_get_position(ghost);
    if (!carPosition) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      cw_setCameraPosition();
      var zoom = camera.zoom;
      ctx.translate(200 - (camera.pos.x * zoom), 200 + (camera.pos.y * zoom));
      ctx.scale(zoom, -zoom);
      cw_drawFloor(ctx, camera, floorTiles);
      ctx.restore();
      return;
    }
    camera.pos.x = carPosition.x;
    camera.pos.y = carPosition.y;
    cw_minimapCamera(camera.pos.x, camera.pos.y);
    showDistance(
      Math.round(carPosition.x * 100) / 100,
      Math.round(carPosition.y * 100) / 100
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(
      200 - (carPosition.x * camera.zoom),
      200 + (carPosition.y * camera.zoom)
    );
    ctx.scale(camera.zoom, -camera.zoom);
    ghost_draw_frame(ctx, ghost, camera);
    ghost_move_frame(ghost);
    cw_drawFloor(ctx, camera, floorTiles);
    ctx.restore();
  }


  function cw_drawCars() {
    var cw_carArray = Array.from(carMap.values());
    for (var k = (cw_carArray.length - 1); k >= 0; k--) {
      var myCar = cw_carArray[k];
      drawCar(carConstants, myCar, camera, ctx)
    }
  }

  function toggleDisplay() {
    canvas.width = canvas.width;
    if (doDraw) {
      doDraw = false;
      cw_stopSimulation();
      cw_runningInterval = setInterval(function () {
        var time = performance.now() + (1000 / screenfps);
        while (time > performance.now()) {
          simulationStep();
        }
      }, 1);
    } else {
      doDraw = true;
      clearInterval(cw_runningInterval);
      cw_startSimulation();
    }
  }

  function cw_drawMiniMap() {
    var floorTiles = currentRunner.scene.floorTiles;
    var last_tile = null;
    var tile_position = new b2Vec2(-5, 0);
    minimapfogdistance = 0;
    fogdistance.width = "800px";
    minimapcanvas.width = minimapcanvas.width;
    minimapctx.strokeStyle = "#3F72AF";
    minimapctx.beginPath();
    minimapctx.moveTo(0, 35 * minimapscale);
    for (var k = 0; k < floorTiles.length; k++) {
      last_tile = floorTiles[k];
      var last_fixture = last_tile.GetFixtureList();
      var last_world_coords = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
      tile_position = last_world_coords;
      minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
    }
    minimapctx.stroke();
  }

  /* ==== END Drawing ======================================================== */
  /* ========================================================================= */
  var uiListeners = {
    preCarStep: function () {
      ghost_move_frame(ghost);
    },
    carStep(car) {
      updateCarUI(car);
    },
    carDeath(carInfo) {

      var k = carInfo.index;

      var car = carInfo.car, score = carInfo.score;
      var cwCar = carMap.get(carInfo);
      cwCar.kill(currentRunner, world_def);

      // refocus camera to leader on death
      if (camera.target == carInfo) {
        cw_setCameraTarget(-1);
      }

      ghost_compare_to_replay(cwCar.replay, ghost, score.v);
      carMap.delete(carInfo);

      score.i = generationState.counter;

      cw_deadCars++;
      var generationSize = generationConfig.constants.generationSize;
      document.getElementById("population").innerHTML = (generationSize - cw_deadCars).toString();

      // console.log(leaderPosition.leader, k)
      if (leaderPosition.leader == k) {
        // leader is dead, find new leader
        cw_findLeader();
      }
    },
    generationEnd(results) {
      cleanupRound(results);
      return cw_newRound(results);
    }
  }

  function simulationStep() {
    currentRunner.step();
    showDistance(
      Math.round(leaderPosition.x * 100) / 100,
      Math.round(leaderPosition.y * 100) / 100
    );
  }

  function gameLoop() {
    loops = 0;
    while (!cw_paused && (new Date).getTime() > nextGameTick && loops < maxFrameSkip) {
      nextGameTick += skipTicks;
      loops++;
    }
    simulationStep();
    cw_drawScreen();

    if (!cw_paused) window.requestAnimationFrame(gameLoop);
  }

  function updateCarUI(carInfo) {
    var k = carInfo.index;
    var car = carMap.get(carInfo);
    var position = car.getPosition();

    ghost_add_replay_frame(car.replay, car.car.car);
    car.minimapmarker.style.left = Math.round((position.x + 5) * minimapscale) + "px";
    car.healthBar.width = Math.round((car.car.state.health / max_car_health) * 100) + "%";
    if (position.x > leaderPosition.x) {
      leaderPosition = position;
      leaderPosition.leader = k;
      // console.log("new leader: ", k);
    }
  }

  function cw_findLeader() {
    var lead = 0;
    var cw_carArray = Array.from(carMap.values());
    for (var k = 0; k < cw_carArray.length; k++) {
      if (!cw_carArray[k].alive) {
        continue;
      }
      var position = cw_carArray[k].getPosition();
      if (position.x > lead) {
        leaderPosition = position;
        leaderPosition.leader = k;
      }
    }
  }

  function fastForward() {
    var gen = generationState.counter;
    while (gen === generationState.counter) {
      currentRunner.step();
    }
  }

  function cleanupRound(results) {

    results.sort(function (a, b) {
      if (a.score.v > b.score.v) {
        return -1
      } else {
        return 1
      }
    })
    graphState = plot_graphs(
      document.getElementById("graphcanvas"),
      document.getElementById("topscores"),
      null,
      graphState,
      results
    );
  }

  function cw_newRound(results) {
    camera.pos.x = camera.pos.y = 0;
    cw_setCameraTarget(-1);

    generationState = manageRound.nextGeneration(
      generationState, results, generationConfig()
    );
    if (world_def.mutable_floor) {
      ghost = null;
      world_def.floorseed = btoa(Math.seedrandom());
    } else {
      ghost_reset_ghost(ghost);
    }
    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    resetCarUI();
  }

  function cw_startSimulation() {
    cw_paused = false;
    window.requestAnimationFrame(gameLoop);
  }

  function cw_stopSimulation() {
    cw_paused = true;
  }

  function cw_clearPopulationWorld() {
    carMap.forEach(function (car) {
      car.kill(currentRunner, world_def);
    });
  }

  function cw_resetPopulationUI() {
    document.getElementById("generation").innerHTML = "";
    document.getElementById("cars").innerHTML = "";
    document.getElementById("topscores").innerHTML = "";
    var _gc = document.getElementById("graphcanvas");
    cw_clearGraphics(_gc, _gc.getContext("2d"), 400, 250);
    resetGraphState();
  }

  function cw_resetWorld() {
    doDraw = true;
    cw_stopSimulation();
    world_def.floorseed = document.getElementById("newseed").value;
    cw_clearPopulationWorld();
    cw_resetPopulationUI();

    Math.seedrandom();
    cw_generationZero();
    currentRunner = worldRun(
      world_def, generationState.generation, uiListeners
    );

    ghost = ghost_create_ghost();
    resetCarUI();
    setupCarUI()
    cw_drawMiniMap();

    cw_startSimulation();
  }

  function setupCarUI() {
    currentRunner.cars.map(function (carInfo) {
      var car = new cw_Car(carInfo, carMap);
      carMap.set(carInfo, car);
      car.replay = ghost_create_replay();
      ghost_add_replay_frame(car.replay, car.car.car);
    })
  }


  document.querySelector("#fast-forward").addEventListener("click", function () {
    fastForward()
  });

  document.querySelector("#save-progress").addEventListener("click", function () {
    saveProgress()
  });

  document.querySelector("#restore-progress").addEventListener("click", function () {
    restoreProgress()
  });

  document.querySelector("#toggle-display").addEventListener("click", function () {
    toggleDisplay()
  })

  document.querySelector("#new-population").addEventListener("click", function () {
    cw_resetPopulationUI()
    cw_generationZero();
    ghost = ghost_create_ghost();
    resetCarUI();
  })

  function saveProgress() {
    localStorage.cw_savedGeneration = JSON.stringify(generationState.generation);
    localStorage.cw_genCounter = generationState.counter;
    localStorage.cw_ghost = JSON.stringify(ghost);
    localStorage.cw_topScores = JSON.stringify(graphState.cw_topScores);
    localStorage.cw_floorSeed = world_def.floorseed;
  }

  function restoreProgress() {
    if (typeof localStorage.cw_savedGeneration == 'undefined' || localStorage.cw_savedGeneration == null) {
      alert("No saved progress found");
      return;
    }
    cw_stopSimulation();
    generationState.generation = JSON.parse(localStorage.cw_savedGeneration);
    generationState.counter = localStorage.cw_genCounter;
    ghost = JSON.parse(localStorage.cw_ghost);
    graphState.cw_topScores = JSON.parse(localStorage.cw_topScores);
    world_def.floorseed = localStorage.cw_floorSeed;
    document.getElementById("newseed").value = world_def.floorseed;

    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    cw_drawMiniMap();
    Math.seedrandom();

    resetCarUI();
    cw_startSimulation();
  }

  document.querySelector("#confirm-reset").addEventListener("click", function () {
    cw_confirmResetWorld()
  })

  function cw_confirmResetWorld() {
    if (confirm('Really reset world?')) {
      cw_resetWorld();
    } else {
      return false;
    }
  }

  // ghost replay stuff


  function cw_pauseSimulation() {
    cw_paused = true;
    ghost_pause(ghost);
  }

  function cw_resumeSimulation() {
    cw_paused = false;
    ghost_resume(ghost);
    window.requestAnimationFrame(gameLoop);
  }

  function cw_startGhostReplay() {
    if (!doDraw) {
      toggleDisplay();
    }
    cw_pauseSimulation();
    cw_ghostReplayInterval = setInterval(cw_drawGhostReplay, Math.round(1000 / screenfps));
  }

  function cw_stopGhostReplay() {
    clearInterval(cw_ghostReplayInterval);
    cw_ghostReplayInterval = null;
    cw_findLeader();
    camera.pos.x = leaderPosition.x;
    camera.pos.y = leaderPosition.y;
    cw_resumeSimulation();
  }

  document.querySelector("#toggle-ghost").addEventListener("click", function (e) {
    cw_toggleGhostReplay(e.target)
  })

  function cw_toggleGhostReplay(button) {
    if (cw_ghostReplayInterval == null) {
      cw_startGhostReplay();
      button.value = "Resume simulation";
    } else {
      cw_stopGhostReplay();
      button.value = "View top replay";
    }
  }
  // ghost replay stuff END

  // initial stuff, only called once (hopefully)
  function cw_init() {
    // clone silver dot and health bar
    var mmm = document.getElementsByName('minimapmarker')[0];
    var hbar = document.getElementsByName('healthbar')[0];
    var generationSize = generationConfig.constants.generationSize;

    for (var k = 0; k < generationSize; k++) {

      // minimap markers
      var newbar = mmm.cloneNode(true);
      newbar.id = "bar" + k;
      newbar.style.paddingTop = k * 9 + "px";
      minimapholder.appendChild(newbar);

      // health bars
      var newhealth = hbar.cloneNode(true);
      newhealth.getElementsByTagName("DIV")[0].id = "health" + k;
      newhealth.car_index = k;
      document.getElementById("health").appendChild(newhealth);
    }
    mmm.parentNode.removeChild(mmm);
    hbar.parentNode.removeChild(hbar);
    world_def.floorseed = btoa(Math.seedrandom());
    cw_generationZero();
    ghost = ghost_create_ghost();
    resetCarUI();
    currentRunner = worldRun(world_def, generationState.generation, uiListeners);
    setupCarUI();
    cw_drawMiniMap();
    window.requestAnimationFrame(gameLoop);

  }

  function relMouseCoords(event) {
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = this;

    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
      currentElement = currentElement.offsetParent
    }
    while (currentElement);

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    return { x: canvasX, y: canvasY }
  }
  HTMLDivElement.prototype.relMouseCoords = relMouseCoords;
  minimapholder.onclick = function (event) {
    var coords = minimapholder.relMouseCoords(event);
    var cw_carArray = Array.from(carMap.values());
    var closest = {
      value: cw_carArray[0].car,
      dist: Math.abs(((cw_carArray[0].getPosition().x + 6) * minimapscale) - coords.x),
      x: cw_carArray[0].getPosition().x
    }

    var maxX = 0;
    for (var i = 0; i < cw_carArray.length; i++) {
      var pos = cw_carArray[i].getPosition();
      var dist = Math.abs(((pos.x + 6) * minimapscale) - coords.x);
      if (dist < closest.dist) {
        closest.value = cw_carArray.car;
        closest.dist = dist;
        closest.x = pos.x;
      }
      maxX = Math.max(pos.x, maxX);
    }

    if (closest.x == maxX) { // focus on leader again
      cw_setCameraTarget(-1);
    } else {
      cw_setCameraTarget(closest.value);
    }
  }


  document.querySelector("#mutationrate").addEventListener("change", function (e) {
    var elem = e.target
    cw_setMutation(elem.options[elem.selectedIndex].value)
  })

  document.querySelector("#mutationsize").addEventListener("change", function (e) {
    var elem = e.target
    cw_setMutationRange(elem.options[elem.selectedIndex].value)
  })

  document.querySelector("#floor").addEventListener("change", function (e) {
    var elem = e.target
    cw_setMutableFloor(elem.options[elem.selectedIndex].value)
  });

  document.querySelector("#gravity").addEventListener("change", function (e) {
    var elem = e.target
    cw_setGravity(elem.options[elem.selectedIndex].value)
  })

  document.querySelector("#elitesize").addEventListener("change", function (e) {
    var elem = e.target
    cw_setEliteSize(elem.options[elem.selectedIndex].value)
  })

  function cw_setMutation(mutation) {
    generationConfig.constants.gen_mutation = parseFloat(mutation);
  }

  function cw_setMutationRange(range) {
    generationConfig.constants.mutation_range = parseFloat(range);
  }

  function cw_setMutableFloor(choice) {
    world_def.mutable_floor = (choice == 1);
  }

  function cw_setGravity(choice) {
    world_def.gravity = new b2Vec2(0.0, -parseFloat(choice));
    var world = currentRunner.scene.world
    // CHECK GRAVITY CHANGES
    if (world.GetGravity().y != world_def.gravity.y) {
      world.SetGravity(world_def.gravity);
    }
  }

  function cw_setEliteSize(clones) {
    generationConfig.constants.championLength = parseInt(clones, 10);
  }

  cw_init();


})();
