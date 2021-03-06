// this can create an infinite loop
// if lord and vassal have armies on each others castles which are empty
// vassal take's lord's castle

// TODO: is there a way to check for enemies with mongodb queries?  use $or maybe
// $nin team $or in team but not in allies or siblings

enemy_on_building_check = function() {
	var start_time = new Date()

	Castles.find({}, {fields: {_id:1, user_id:1, x:1, y:1}}).forEach(function(res) {
		check_for_enemies_here(res, 'castle')
	})

	Villages.find({}, {fields: {_id:1, user_id:1, x:1, y:1}}).forEach(function(res) {
		check_for_enemies_here(res, 'village')
	})

	record_job_stat('enemy_on_building_check', new Date() - start_time)
}


var check_for_enemies_here = function(building, type) {
	var armies = Armies.find({x:building.x, y:building.y, user_id: {$ne: building.user_id}}, {fields: {user_id:1}})
	if (armies.count() > 0) {
		armies.forEach(function(army) {
			var relation = getPlayersRelationType_server(army.user_id, building.user_id)
			var canAttack = ['king', 'direct_lord', 'lord', 'enemy', 'enemy_ally']
			if (_.contains(canAttack, relation)) {
				if (!attackCreatesLoop(building.x,building.y)) {
					Battle.start_battle(building.x,building.y)
				}
			}
		})
	}
}


// loop through every army and check if there are any enemies on the same hex, if so they fight
enemies_together_check = function() {
	var start_time = new Date()

	Armies.find({}, {fields: {user_id:1, x:1, y:1}}).forEach(function(army) {

		// find armies here except this one
		Armies.find({x:army.x, y:army.y, _id: {$ne: army._id}, user_id: {$ne: army.user_id}}, {fields: {user_id:1}}).forEach(function(other_army) {

			// make sure army still exists
			var a = Armies.findOne(army._id, {fields: {user_id:1}})
			if (a) {

				// if one of them is dominus then they fight
				var user = Meteor.users.findOne(a.user_id, {fields: {is_dominus:1}})
				var otherUser = Meteor.users.findOne(other_army.user_id, {fields: {is_dominus:1}})
				if (user && otherUser) {
					if (user.is_dominus || otherUser.is_dominus) {
						// dominus' armies can attack any army
						Battle.start_battle(army.x,army.y)

					} else {
						var relation = getPlayersRelationType_server(user._id, otherUser._id)
						var canAttack = ['enemy', 'enemy_ally']
						if (_.contains(canAttack, relation)) {

							if (!attackCreatesLoop(army.x, army.y)) {
								Battle.start_battle(army.x,army.y)
							}
						}
					}
				}
			}
		})
	})

	record_job_stat('enemies_together_check', new Date() - start_time)
}


var attackCreatesLoop = function(x, y) {
	var isLoop = false

	var castleHere = Castles.findOne({x:x, y:y}, {fields: {user_id:1}})
	if (castleHere) {

		var armiesHere = Armies.find({x:x, y:y}, {fields: {user_id:1}})
		armiesHere.forEach(function(armyHere) {

			// don't check armies on their own castle
			if (castleHere.user_id != armyHere.user_id) {

				// get their castle
				var castle = Castles.findOne({user_id:armyHere.user_id}, {fields: {x:1, y:1}})
				if (castle) {

					// is there an army at their castle owned by castleHere
					if (Armies.find({x:castle.x, y:castle.y, user_id:castleHere.user_id}).count() > 0) {
						isLoop = true
					}
				}
			}
		})
	}

	return isLoop
}
