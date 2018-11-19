const MIN_PICKUP_ENERGY = 50 //minimum amount of energy to pick up;


Creep.prototype._moveTo = Creep.prototype.moveTo;
Creep.prototype.moveTo = function(pos, opts) {
    if (!pos) return ERR_INVALID_TARGET;
    let options = {}
    if (opts) options = opts;
    //if (!this.pos.inRangeTo(pos,3)) options.ignoreCreeps = true;
    
    //options.noPathFinding = true;
    this._moveTo(pos,options);
}


function findEnergy(creep) {
    let flag = getFlag(creep);
    let room = creep.room;
    
    
    if (creep.carryCapacity > 0) {
        if (creep.carry.energy == 0) creep.memory.actie = 'energie';
        else if (creep.carry.energy == creep.carryCapacity) creep.memory.actie = 'werken';
    }
    
    if (creep.memory.actie == 'energie') {
        if (flag && flag.room!=creep.room) {
            creep.moveTo(flag);
            return;
        }
        let targets = []
        targets = targets.concat(room.find(FIND_TOMBSTONES, {filter: o => o.store.energy > MIN_PICKUP_ENERGY}));
        targets = targets.concat(room.find(FIND_STRUCTURES, {filter: o => o.store && o.store.energy >= MIN_PICKUP_ENERGY}));
        targets = targets.concat(room.find(FIND_DROPPED_RESOURCES, {filter: o => o.resourceType == RESOURCE_ENERGY && o.amount >= MIN_PICKUP_ENERGY}));
        targets = targets.concat(room.find(FIND_MY_STRUCTURES, {filter: o => o.structureType == STRUCTURE_LINK && o.energy >= MIN_PICKUP_ENERGY}));
        
        if (targets.length>0) {
            let target = creep.pos.findClosestByRange(targets);
            creep.moveTo(target);
            creep.withdraw(target,RESOURCE_ENERGY);
            creep.pickup(target,RESOURCE_ENERGY);
            creep.say('e');
            return;
        }
        
        let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        creep.moveTo(source);
        creep.harvest(source);
        creep.say('e');
        return;
    }
}

function getFlag (creep) {
    let flagName = creep.name.substr(2);
    let flag = Game.flags[flagName];
    return flag;
}

function runTransporter(creep) {
    let flag = getFlag(creep);

    if (creep.carryCapacity > 0) {
        if (creep.carry.energy == 0) creep.memory.actie = 'energie';
        else if (creep.carry.energy == creep.carryCapacity) creep.memory.actie = 'werken';
    }

    if (creep.carry.energy == 0 && (flag.room == undefined || creep.room.name != flag.room.name )) {
        creep.moveTo(flag);
        return;
    }
    
    let targets = creep.room.find(FIND_STRUCTURES, {filter: o => o.store});
    //targets = targets.concat(creep.room.find(FIND_MY_STRUCTURES, {filter: o => o.structureType == STRUCTURE_LINK}));

    targets.sort((a,b) => {
        let a_val;
        if (a.store) a_val = a.store.energy / a.storeCapacity;
        else a_val = a.energy / a.energyCapacity;
        let b_val;
        if (b.store) b_val = b.store.energy / b.storeCapacity;
        else b_val = b.energy / b.energyCapacity;
        if (a_val < b_val) return -1;
        if (a_val > b_val) return 1;
        return 0;
    })
    if (targets.length < 2) {
        creep.moveTo(flag);
        return;
    }

    if (creep.memory.actie == 'energie') {
        let target = targets[targets.length-1];
        creep.moveTo(target);
        let droppedEnergy = target.pos.lookFor(LOOK_RESOURCES)
        let result;
        if (droppedEnergy.length > 0) creep.pickup(droppedEnergy[0]);
        else result = creep.withdraw(target,RESOURCE_ENERGY);
        creep.say('t<-')
        if (result == 0) Memory.structures[target.id].lastSink = Game.time;
        return;
    }   
    else {
        if (creep.room.name != creep.memory.homeRoomName) {
            creep.moveTo(Game.rooms[creep.memory.homeRoomName].controller);
            return;
        }
        let target = targets[0];
        creep.moveTo(target);
        let result;
        result = creep.transfer(target,RESOURCE_ENERGY);
        if (result == 0) Memory.structures[target.id].lastSource = Game.time;
        //Memory.strMem[target.id].last
        creep.say('t->')
        return;
    }
}

function runHarvester (creep) {
    let flag = getFlag(creep);
    if (creep.pos.isEqualTo(flag.pos)) {
        let source = Game.getObjectById(creep.memory.sourceId);
        if (source == undefined) {
            source = creep.pos.findInRange(FIND_SOURCES_ACTIVE, 1)[0];
            if (source) creep.memory.sourceId = source.id;
        }
        let result = creep.harvest(source);
        creep.say('h');
    } else {
        creep.moveTo(flag);
    }
}

function runWerker (creep) {
    
    findEnergy(creep);
    
    if (creep.memory.actie == 'werken'){
        let flag = getFlag(creep);
        let room = creep.room;
        if ((room.controller && room.controller.my && room.controller.ticksToDowngrade < 3500) || room.memory.noodUpgr) {
            creep.moveTo(room.controller);
            creep.upgradeController(room.controller);
            creep.say('u');
            room.memory.noodUpgr = (room.controller.ticksToDowngrade < 5000)
            return;
        }
        
        let structure = creep.pos.findClosestByRange (FIND_MY_STRUCTURES,
                                                    {filter: o => ( o.structureType == STRUCTURE_SPAWN
                                                                   || o.structureType == STRUCTURE_EXTENSION
                                                                   || o.structureType == STRUCTURE_TOWER)
                                                                 && o.energy < o.energyCapacity}
                                                    );
        if (structure) {
            creep.moveTo(structure);
            creep.transfer(structure, RESOURCE_ENERGY);
            creep.say('v');
            return;
        }



        let buildingsite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
        if (buildingsite) {
            creep.moveTo(buildingsite);
            creep.build(buildingsite);
            creep.say('b');
            return;
        }

        let homeRoom = Game.rooms[creep.memory.homeRoomName];
        if (homeRoom == undefined) homeRoom = creep.room;
        creep.moveTo(homeRoom.controller);
        creep.upgradeController(homeRoom.controller);
        creep.say('u');
        return;
    }
}

function runRepareerder(creep) {
    
    findEnergy(creep);

    if (creep.memory.actie == 'werken') {
        let flag = getFlag(creep);
        let room = flag?flag.room:undefined;
        let structure;
        if (creep.memory.structureID) structure = Game.getObjectById(creep.memory.structureID)
        
        if (structure == undefined) {
            let structures = creep.room.find (FIND_STRUCTURES,
                                                        {filter: o => ( o.structureType == STRUCTURE_WALL
                                                                       || o.structureType == STRUCTURE_RAMPART
                                                                       || o.structureType == STRUCTURE_ROAD
                                                                       || o.structureType == STRUCTURE_CONTAINER)
                                                                       && o.hits < o.hitsMax / 2}
                                                        );
            
            if (structures.length > 0) {
                structures.sort ((a, b) => {
                    let aPow = Math.floor(Math.log2(a.hits));
                    let bPow = Math.floor(Math.log2(b.hits));
                    if (aPow < bPow) return -1;
                    if (aPow > bPow) return 1;
                    return 0;
                });
                
                let minHitsPow = Math.floor(Math.log2(structures[0].hits));
                let structures2 = [];
                for (let i = 0; i < structures.length && minHitsPow == Math.floor(Math.log2(structures[i].hits)); i++ ) {
                    structures2.push(structures[i]);
                }
                structure = creep.pos.findClosestByRange(structures2)
                creep.memory.minHitsPow = minHitsPow
            }
        }

        if (structure) {
            creep.moveTo(structure, {range: 2});
            creep.repair(structure);
            creep.say('r');
            if (structure.hits == structure.hitsMax || structure.hits >= Math.pow(2,creep.memory.minHitsPow+2)) {
                creep.memory.structureID = undefined;
            } else {
                creep.memory.structureID = structure.id;
            }
        }  else {
            creep.moveTo(flag);
        }  
    } else {
        creep.memory.structureID = undefined;
    }
}

function runAanvaller(creep) {
    let flag = getFlag(creep);
    let target;
    if (flag && creep.pos.roomName == flag.pos.roomName) {
        target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if (target == undefined) target = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter: o => o.structureType != STRUCTURE_CONTROLLER});
    }
    if (target) {
        creep.rangedAttack(target);
        creep.moveTo(target);
        creep.say('aanvallen!')
    } else {
        creep.moveTo(flag);
        creep.say('aa');
    }
    let injuredCreep = creep.pos.findClosestByRange(creep.pos.findInRange(FIND_MY_CREEPS, {filter: o => o.hits < o.hitsMax}));
    if (injuredCreep) {
        creep.heal (injuredCreep);
    }
}

function runSpawn(spawn) {

    let room = spawn.room;
    if (room.memory.baseName == undefined) room.memory.baseName = spawn.name;
    
    let creepBase = [];
    let creepEnergy = 0;
    let spawnName;
    let rol = 'werker'
    let creepExpand = true;
    
    let baseName = room.memory.baseName;


    // aanvaller spawnen voor elke vlag
    let prioriteit = 100;
    for (let flagName in Game.flags) {
        if (!flagName.startsWith(baseName)) continue;
        let flag = Game.flags[flagName];
        let aantalCreeps = flag.secondaryColor - 1;
        switch (flag.color) {
        case COLOR_WHITE: // werker
            if (prioriteit <= 1) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 'w'  + i + flagName;;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [MOVE,CARRY,WORK];
                    creepEnergy = 200
                    rol = 'werker'
                    prioriteit = 1;
                    i = 99;
                }
            }
            break;
            
            
        case COLOR_BROWN: // repareerder
            if (prioriteit <= 5) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 'r' + i + flagName;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [MOVE,CARRY,WORK];
                    creepEnergy = 200
                    rol = 'repareerder'
                    prioriteit = 5;
                    i = 99;
                }
            }
            break;
        case COLOR_RED: // aanvaller
            if (prioriteit <= 10) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 'a' + i + flagName;;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [TOUGH,MOVE,MOVE,RANGED_ATTACK,HEAL];
                    creepEnergy = 510;
                    rol = 'aanvaller'
                    prioriteit = 10;
                    i=99;
                }
            }
            break;
        case COLOR_YELLOW: // claimer
            if (prioriteit <=20) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 'c' + i + flagName;;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [MOVE,MOVE,CLAIM];
                    creepEnergy = 650;
                    rol = 'claimer'
                    prioriteit = 20;
                    i=99;
                }
            }
            break;
        case COLOR_BLUE: // harvester
            if (prioriteit <=7) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 'h' + i + flagName;;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK];
                    creepEnergy = 750;
                    creepExpand = false;
                    rol = 'harvester'
                    prioriteit = 7;
                    i=99;
                }
            }
            break;
        case COLOR_GREEN: // transporter
            if (prioriteit <= 8) break;
            for (let i=0; i < aantalCreeps; i++) {
                let creepName = 't'  + i + flagName;;
                let creep = Game.creeps[creepName];
                if (creep == undefined) {
                    spawnName = creepName;
                    creepBase = [MOVE,CARRY,CARRY];
                    creepEnergy = 200
                    rol = 'transporter'
                    prioriteit = 8;
                    i = 99;
                }
            }
            break;
        }
    }

    if (spawnName) {
        let creepBody = [];
        if (creepExpand) {
            let bodyBlocks = Math.floor(room.energyCapacityAvailable/creepEnergy);
            if (_.isEmpty(_.filter(Game.creeps,o => o.memory.homeRoomName == room.name))) bodyBlocks = Math.floor(room.energyAvailable/creepEnergy);
            for (let i = 0;i < bodyBlocks && bodyBlocks.length + creepBody.length <= 50; i++) creepBody = creepBody.concat(creepBase);
        } else {
            creepBody = creepBase;
        }
        spawn.spawnCreep(creepBody, spawnName, {memory: {rol: rol, homeRoomName: spawn.room.name}});    
    }
}

function runTower(tower) {
    let room = tower.room;
    let hostileCreep = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (hostileCreep) {
        tower.attack(hostileCreep);
        return;
    }
    let injuredCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {filter: o => o.hits < o.hitsMax});
    if (injuredCreep) {
        tower.heal(injuredCreep);
        return;
    }
    
}

function runClaimer(creep) {
    let flagName = creep.name.substr(2);
    let flag = Game.flags[flagName];
    let targetRoom = flag && flag.room;
    if (targetRoom && targetRoom.controller && !targetRoom.controller.my) {
        creep.moveTo(targetRoom.controller);
        creep.claimController(targetRoom.controller);
        creep.say('c')
    } else creep.moveTo(flag);
}

function runCreep(creep) {
        
    switch (creep.memory.rol) {
    case 'aanvaller':
        runAanvaller(creep);
        break;
        
    case 'werker':
        runWerker(creep);
        break;

    
    case 'repareerder':
        runRepareerder(creep);
        break;
    
    case 'claimer':
        runClaimer(creep);
        break;
    
    case 'harvester':
        runHarvester(creep);
        break;

    case 'transporter':
        runTransporter(creep);
        break;
    }
       
}

firstRun();
function firstRun() {
    if (Memory.structures == undefined) Memory.structures = {};
    cleanMemory();
}

module.exports.loop = function () {
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        for (let structure of room.find(FIND_MY_STRUCTURES)) {
            switch (structure.structureType) {
                case STRUCTURE_SPAWN:
                    runSpawn(structure);
                    break;
                    
                case STRUCTURE_TOWER:
                    runTower(structure);
                    break;
            }
        }
    }
    
    for (var creepName in Game.creeps) {
        var creep = Game.creeps[creepName];
        try {
            runCreep(creep);
        }
        catch (err) {
            throw err;
        }
    }
    
    if (Game.time % 10000 == 0) cleanMemory();
}

function cleanMemory() {
    for(var i in Memory.creeps) {
        if(!Game.creeps[i]) {
            delete Memory.creeps[i];
        }
    }
    
    for(var i in Memory.structures) {
        if(!Game.getObjectById(i)) {
            delete Memory.structures[i];
        }
    }
}
