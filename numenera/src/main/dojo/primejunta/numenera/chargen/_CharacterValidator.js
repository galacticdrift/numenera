/**
 * Most of the "intelligence" of this utility is here. Assembles lists collected from CharacterGenerator,
 * merges duplicate (T)rained skills into (S)pecialized, applies bonuses from special abilities, checks for
 * duplicate perks and other stupidities, and so on. Writes the result into a cleaned-up object that can
 * go into the _CharacterRecord. Also used to check that a character is ready for advancement.
 */
define([ "dojo/_base/declare",
         "dojo/_base/lang",
         "dojo/_base/array",
         "dojo/string",
         "./data/descriptors",
         "./data/types",
         "./data/foci",
         "./data/feats",
         "./data/exceptions" ],
function( declare,
          lang,
          array,
          string,
          descriptors,
          types,
          foci,
          feats,
          exceptions )
{
    return declare([], {
        /**
         * Prefix of Trained skills.
         */
        TRAINED_STR : "Ⓣ ",
        /**
         * Prefix of Specialized skills.
         */
        SPECIALIZED_STR: "Ⓢ ",
        /**
         * String denoting a null item on a select.
         */
        CHOOSE_STR : "-- choose --",
        /**
         * Parent CharacterGenerator.
         */
        manager : {},
        /**
         * Mix in kwObj.
         */
        constructor : function( /* Object */ kwObj )
        {
            this.IGNORE_ITEMS = [ "",
                                 "Ⓣ",
                                 "Ⓢ",
                                 this.TRAINED_STR,
                                 this.SPECIALIZED_STR,
                                 this.CHOOSE_STR,
                                 this.TRAINED_STR + this.CHOOSE_STR,
                                 this.SPECIALIZED_STR + this.CHOOSE_STR ];
            lang.mixin( this, kwObj );
        },
        /**
         * Validate character. If silent, no alerts will be raised. We .analyzeCharacter first though.
         */
        validateCharacter : function( /* boolean? */ silent )
        {
            var errs = [];
            if( !this.manager.getType() || !this.manager.getDescriptor() || !this.manager.getFocus() )
            {
                errs.push( "Please select a descriptor, type, and focus." );
            }
            if( this.manager.free_pool.value != "0" || this.manager.free_edge.value != "0" )
            {
                errs.push( "Please assign all of your character points." );
            }
            this.analyzeCharacter();
            var _sl = this._cdata.special_list;
            var _al = this._cdata.ability_list;
            // Look for missing choices. We use the "raw" lists so the -- choose -- strings are included.
            if( this._listAsText( "special_list" ).join( "," ).indexOf( this.CHOOSE_STR ) != -1 )
            {
                errs.push( "Please make all your special ability choices." );
            }
            if( this._listAsText( "ability_list" ).join( "," ).indexOf( this.CHOOSE_STR ) != -1 || this._listAsText( "ability_list" ).join( "," ).indexOf( this.TRAINED_STR + "," ) != -1 )
            {
                errs.push( "Please make all your skill choices." );
            }
            if( this._listAsText( "equipment_list" ).join( "," ).indexOf( this.CHOOSE_STR ) != -1  )
            {
                errs.push( "Please make all equipment choices." );
            }
            if( array.indexOf( _sl, "Ⓔ Weapon Master: " ) != -1 )
            {
                errs.push( "Please select your chosen weapon, O Weapon Master." );
            }
            if( array.indexOf( _al, this.TRAINED_STR + "Knowledge area:" ) != -1 || array.indexOf( _al, this.SPECIALIZED_STR + "Knowledge area:" ) != -1 )
            {
                errs.push( "Please choose your knowledge areas." );
            }
            if( array.indexOf(  _al, this.TRAINED_STR ) != -1 || array.indexOf( _al, this.SPECIALIZED_STR ) != -1 )
            {
                errs.push( "Please choose all your skills." );
            }
            // Look for duplicate perks.
            var _plist = [ "Ⓔ Reduce Armor Cost", "Ⓔ Recovery Roll +2", this.CHOOSE_STR ];
            for( var i = 1; i < _sl.length; i++ )
            {
                if( _sl[ i ] == _sl[ i - 1 ] && array.indexOf( _plist, _sl[ i ] ) == -1 )
                {
                    errs.push( "You cannot take the special ability " + _sl[ i ] + " twice." );
                }
            }
            // Enforce combat skill specialization limit.
            if( this._cdata.character_type != "glaive" || this._cdata.character_tier < 5 )
            {
                var _cats = [ "Light", "Medium", "Heavy" ];
                var _types = [ "Bashing", "Bladed", "Ranged" ];
                for( var i = 0; i < _cats.length; i++ )
                {
                    for( var j = 0; j < _types.length; j++ )
                    {
                        if( array.indexOf( _al, this.SPECIALIZED_STR + _cats[ i ] + " " + _types[ j ] ) != -1 )
                        {
                            errs.push( "You cannot specialize in " + _cats[ i ] + " " + _types[ j ] + " at your tier." );
                        }
                    }
                }
            }
            // Enforce defense skill specialization limit
            if(  this._cdata.character_type == "nano" || this._cdata.character_tier < 5 )
            {
                var _cats = [ "Might", "Speed", "Intellect" ];
                for( var i = 0; i < _cats.length; i++ )
                {
                    if( array.indexOf( _al, this.SPECIALIZED_STR + _cats[ i ] + " Defense" ) != -1 && !this._maySpecialize( _cats[ i ] + " Defense" ) )
                    {
                        errs.push( "You cannot specialize in " + _cats[ i ] + " Defense at your tier." );
                    }
                }
            }
            if( errs.length == 0 )
            {
                return true;
            }
            else
            {
                if( !silent )
                {
                    this.manager.tell( errs.join( "<br/><br/>" ) );
                }
                return false;
            }
        },
        /**
         * Checks if the character's focus or descriptor entitles him/her to specialize in a defense skill despite the usual
         * restrictions. My interpretation is that if you get a Defense for free from a descriptor or focus, you're allowed
         * to specialize in it starting from that point.
         */
        _maySpecialize : function( /* String */ defenseSkill )
        {
            try
            {
                if( exceptions[ defenseSkill ].descriptors && exceptions[ defenseSkill ].descriptors[ this._cdata.character_descriptor ] <= this._cdata.character_tier 
                        || exceptions[ defenseSkill ].foci && exceptions[ defenseSkill ].foci[ this._cdata.character_focus ] <= this._cdata.character_tier )
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            catch( e )
            {
                console.log( e );
                return false;
            }
        },
        /**
         * Copy values from CharacterGenerator, and apply bonuses with _getAttacks, _processAttackValues, _processArmorValues,
         * and _getAttackList.
         */
        analyzeCharacter : function()
        {
            this._cdata = {};
            this._sv( "character_name", "characterNameInput" );
            this._sv( "character_descriptor", "descriptorSelect", 1 );
            this._sv( "character_type", "typeSelect", 1 );
            this._sv( "character_focus", "focusSelect", 1 );
            this._ss( "character_tier", "character_tier" );
            this._ss( "character_effort", "character_effort" );
            this._ss( "might_pool", "might_pool" );
            this._ss( "might_edge", "might_edge" );
            this._ss( "speed_pool", "speed_pool" );
            this._ss( "speed_edge", "speed_edge" );
            this._ss( "intellect_pool", "intellect_pool" );
            this._ss( "intellect_edge", "intellect_edge" );
            this._ss( "recovery_roll", "recovery_roll" );
            this._ss( "cypher_count", "cypher_count" );
            this._ss( "shin_count", "shin_count" );
            this._ss( "character_xp", "character_xp" );
            this._st( "description_text", this._textAsList( "description_text" ) );
            this._wl( "ability_list", this._getSkillList() );
            this._wl( "special_list", this._getSpecialList() );
            this._wl( "cypher_list", this._listAsText( "cypher_list") );
            this._wl( "equipment_list", this._getEquipmentList() );
            this._wl( "notes_list", this._textAsList( "notes_text" ) );
            this._wl( "attack_data", this._getAttacks() );
            this._processAttackValues();
            this._processArmorValues();
            this._wl( "attack_list", this._getAttackList() );
            return this._cdata;
        },
        /**
         * We're parsing out weapons from equipment_list by keywords - Light, Medium, Heavy, Bashing, Bladed, Ranged.
         * Then we create an object representing each of them, with description (the string we started with), short_name
         * (anything after the category, type, and "Weapon:"), damage, category, type, and difficulty_adjustment (1 for Light).
         */
        _getAttacks : function()
        {
            var eq = this._cdata.equipment_list;
            var out = [];
            var wpns = [];
            var idstr = "weapon:";
            for( var i = 0; i < eq.length; i++ )
            {
                if( eq[ i ].toLowerCase().indexOf( idstr ) != -1 )
                {
                    wpns.push( eq[ i ] );
                }
            }
            for( var i = 0; i < wpns.length; i++ )
            {
                var cur = wpns[ i ].toLowerCase();
                var wpn = {
                    description : wpns[ i ],
                    short_name : string.trim( wpns[ i ].substring( cur.indexOf( idstr ) + idstr.length + 1 ) ),
                    damage : 0,
                    category : "",
                    type : "",
                    difficulty_adjustment : 1
                }
                var dmg = 0;
                var diff = 1;
                var type = "";
                if( cur.indexOf( "light" ) != -1 )
                {
                    wpn.damage = 2;
                    wpn.difficulty_adjustment = 0;
                    wpn.category = "light";
                }
                else if( cur.indexOf( "medium" ) != -1  )
                {
                    wpn.damage = 4;
                    wpn.category = "medium";
                }
                else if( cur.indexOf( "heavy" ) != -1  )
                {
                    wpn.damage = 6;
                    wpn.category = "heavy";
                }
                if( cur.indexOf( "bashing" ) != -1 )
                {
                    wpn.type = "bashing";
                }
                else if( cur.indexOf( "bladed" ) != -1 )
                {
                    wpn.type = "bladed";
                }
                else if( cur.indexOf( "ranged" ) != -1 )
                {
                    wpn.type = "ranged";
                }
                out.push( wpn );
            }
            return out;
        },
        /**
         * Collects bonuses derived from special abilities, read from feats (a dependency). We have to deal with Weapon Master
         * here though since it isn't a fixed value but contains the chosen_weapon, which we also need to parse out..
         */
        _processAttackValues : function()
        {
            var eq = this._cdata.special_list;
            var sl = this._cdata.ability_list;

            // attacks
            // collect boosts by type, category, short_name
            var boosts = {
                "light_bashing" : 0,
                "light_bladed" : 0,
                "light_ranged" : 0,
                "medium_bashing" : 0,
                "medium_bladed" : 0,
                "medium_ranged" : 0,
                "heavy_bashing" : 0,
                "heavy_bladed" : 0,
                "heavy_ranged" : 0,
                "damage_bonus" : 0,
                "light" : 0,
                "medium" : 0,
                "heavy" : 0,
                "chosen_weapon_bonus" : 0
            };
            // Find the chosen weapon for weapon mastery.
            for( var i = 0; i < eq.length; i++ )
            {
                var wms = "Ⓔ Weapon Master:";
                if( eq[ i ].indexOf( wms ) != -1 )
                {
                    this._cdata.chosen_weapon = string.trim( eq[ i ].substring( wms.length ) ).toLowerCase();
                    boosts = lang.mixin( boosts, feats.attack_adjustments[ "Ⓔ Weapon Master" ] );
                }
            }
            // Bonuses from special abilities.
            for( var o in feats.attack_adjustments )
            {
                if( this._has( o ) )
                {
                    boosts = lang.mixin( boosts, feats.attack_adjustments[ o ] )
                }
            }
            // training
            var cats = [ "heavy", "medium", "light" ];
            var types = [ "bashing", "bladed", "ranged" ];
            for( var i = 0; i < cats.length; i++ )
            {
                for( var j = 0; j < types.length; j++ )
                {
                    var boost = cats[ i ] + "_" + types[ j ];
                    var skill = cats[ i ].charAt( 0 ).toUpperCase() + cats[ i ].substring( 1 ) + " " + types[ j ].charAt( 0 ).toUpperCase() + types[ j ].substring( 1 );
                    if( array.indexOf( sl, this.SPECIALIZED_STR + skill ) != -1 )
                    {
                        boosts[ boost ] += 2;
                    }
                    else if( array.indexOf( sl, this.TRAINED_STR + skill ) != -1 )
                    {
                        boosts[ boost ] += 1;
                    }
                }
            }
            for( var i = 0; i < this._cdata.attack_data.length; i++ )
            {
                var cur = this._cdata.attack_data[ i ];
                // chosen weapon
                if( this._cdata.chosen_weapon && cur.short_name.toLowerCase() == this._cdata.chosen_weapon.toLowerCase() )
                {
                    cur.damage += boosts.chosen_weapon_bonus;
                }
                // general damage bonus
                cur.damage += boosts.damage_bonus;
                // category
                cur.difficulty_adjustment -= boosts[ cur.category ];
                // type
                cur.difficulty_adjustment -= boosts[ cur.category + "_" + cur.type ];
            }
        },
        /**
         * We're going through our list of Enablers to find any that affect armor properties -- the armor value itself or
         * the fatigue penalties for it. Then we write out the values for each armor type into _cdata.
         */
        _processArmorValues : function()
        {
            var aBase = parseInt( this._gf( "armor_bonus" ) );
            var pBase = 0;
            var _sl = this._cdata.special_list;
            for( var i = 0; i < _sl.length; i++ )
            {
                if( _sl[ i ] == "Ⓔ Reduce Armor Cost" )
                {
                    pBase--;
                }
            }
            for( var o in feats.armor_adjustments )
            {
                if( this._has( o ) )
                {
                    aBase += feats.armor_adjustments[ o ].armor_adjustment ? feats.armor_adjustments[ o ].armor_adjustment : 0;
                    pBase += feats.armor_adjustments[ o ].armor_penalty_adjustment ? feats.armor_adjustments[ o ].armor_penalty_adjustment : 0;
                }
            }
            this._cdata.armor_value_none = aBase;
            this._cdata.armor_value_light = aBase + 1;
            this._cdata.armor_value_medium = aBase + 2;
            this._cdata.armor_value_heavy = aBase + 3;
            this._cdata.armor_speed_cost_heavy = pBase + 5 > 0 ? pBase + 5 : 0;
            this._cdata.armor_might_cost_heavy = pBase + 3 > 0 ? pBase + 3 : 0;
            this._cdata.armor_speed_cost_medium = pBase + 3 > 0 ? pBase + 3 : 0;
            this._cdata.armor_might_cost_medium = pBase + 2 > 0 ? pBase + 2 : 0;
            this._cdata.armor_speed_cost_light = pBase + 2 > 0 ? pBase + 2 : 0;
            this._cdata.armor_might_cost_light = pBase + 1 > 0 ? pBase + 1 : 0;
        },
        /**
         * We're merging any duplicate (T)rained skills into (S)pecialized and returning the result. We're also merging
         * in any skill received as special abilities (happens for certain foci).
         */
        _getSkillList : function()
        {
            var list = this._listAsText( "ability_list" );
            var _slist = this._listAsText( "special_list" );
            while( _slist.length > 0 )
            {
                var cur = _slist.shift();
                if( this._isSkill( cur ) )
                {
                    list.push( cur );
                }
            }
            list.sort();
            if( list.length < 2 )
            {
                return list;
            }
            var out = [];
            out.push( list[ 0 ] );
            for( var i = 1; i < list.length; i++ )
            {
                if( list[ i ].toLowerCase() == list[ i - 1 ].toLowerCase() && list[ i ].indexOf( this.TRAINED_STR ) != -1 )
                {
                    var cur = out[ out.length - 1 ];
                    out[ out.length - 1 ] = this.SPECIALIZED_STR + cur.substring( cur.indexOf( this.TRAINED_STR ) + this.TRAINED_STR.length );
                }
                else
                {
                    out.push( list[ i ] );
                }
            }
            out.sort();
            return out;
        },
        /**
         * Filters out skills from special_list, since they're injected into skill list in _getSkillList.
         */
        _getSpecialList : function()
        {
            var _sl = this._listAsText( "special_list");
            var out = [];
            while( _sl.length > 0 )
            {
                var cur = _sl.shift();
                if( !this._isSkill( cur ) )
                {
                    out.push( cur );
                }
            }
            out.sort();
            return out;
        },
        /**
         * Filters out "-- choose --" items from equipment list.
         */
        _getEquipmentList : function()
        {
            var list = this._listAsText( "equipment_list" ).concat( this._textAsList( "extra_equipment_text") );
            var out = [];
            while( list.length > 0 )
            {
                var cur = list.pop();
                if( cur.indexOf( this.CHOOSE_STR ) == -1 )
                {
                    out.push( cur );
                }
            }
            out.sort();
            return out;
        },
        /**
         * Checks if item is a skill and returns true or false accordingly.
         */
        _isSkill : function( /* String */ item )
        {
            if( item.indexOf( this.TRAINED_STR ) == 0 || item.indexOf( this.SPECIALIZED_STR ) == 0 )
            {
                return true;
            }
            else
            {
                return false;
            }
        },
        /**
         * Outputs contents of attack_data as String[] suitable for printing out in the sheet. Each attack
         * is prefixed with (L)/(M)/(H) + (B)/(C)/(R), and suffixed with the difficulty adjustment and damage.
         */
        _getAttackList : function()
        {
            var out = [];
            for( var i = 0; i < this._cdata.attack_data.length; i++ )
            {
                var cur = this._cdata.attack_data[ i ];
                var pf = "";
                switch( cur.category )
                {
                    case "light" :
                        pf = "Ⓛ";
                        break;
                    case "medium" : 
                        pf = "Ⓜ";
                        break;
                    case "heavy" : 
                        pf = "Ⓗ";
                        break;
                }
                switch( cur.type )
                {
                    case "bashing" :
                        pf += "Ⓑ";
                        break;
                    case "bladed" : 
                        pf += "Ⓒ";
                        break;
                    case "ranged" : 
                        pf += "Ⓡ";
                        break;
                }
                out.push( pf + " " + cur.short_name + " (" + cur.difficulty_adjustment + "/" + cur.damage + ")" );
            }
            return out.sort();
        },
        /**
         * Split contents of Textarea matching textArea by newline, and return the result.
         */
        _textAsList : function( /* String */ textArea )
        {
            var dt = this.manager[ textArea ].get( "value" );
            dt = dt.split( "\n" );
            return dt;
        },
        /**
         * Connects directly to manager.listAsText.
         */
        _listAsText : function( /* String */ listName )
        {
            return this.manager.listAsText( listName );
        },
        /**
         * Checks if feat is present in special_list, and returns true or false.
         */
        _has : function( /* String */ feat )
        {
            var sl = this._cdata.special_list;
            if( array.indexOf( sl, feat ) != -1 )
            {
                return true;
            }
            else
            {
                return false;
            }
        },
        /**
         * Copies srcList to property matching to, ignoring any items in IGNORE_ITEMS.
         */
        _wl : function( /* String */ to, /* String[]|Object[] */ srcList )
        {
            this._cdata[ to ] = [];
            var list = lang.clone( srcList );
            for( var i = 0; i < list.length; i++ )
            {
                if( array.indexOf( this.IGNORE_ITEMS, list[ i ] ) == -1 )
                {
                    this._cdata[ to ].push( list[ i ] );
                }
            }
        },
        /**
         * Returns field value of fld in character generator, if present, or false.
         */
        _gf : function( /* String */ fld )
        {
            if( !this.manager[ fld ] )
            {
                return false;
            }
            return this.manager[ fld ].value;
        },
        /**
         * Returns display value of select matching sel as String.
         */
        _gs : function( /* String */ sel )
        {
            return this.manager._selVal( this.manager[ sel ] ).label;
        },
        /**
         * Sets value of property fieldName to value matching from in character generator. If sel is set, 
         * reads select value, else reads input value.
         */
        _sv : function( /* String */ fieldName, /* String */ from, /* boolean? */ sel )
        {
            this._cdata[ fieldName ] = sel ? this._gs( from ) : this._gf( from );
        },
        /**
         * Sets stat value matching fieldName to integer parsed from character generator, or zero if not set or
         * not a number.
         */
        _ss : function( /* String */ fieldName, /* String */ from )
        {
            var val = parseInt( this._gf( from ) );
            this._cdata[ fieldName ] = isNaN( val ) ? 0 : val;
        },
        /**
         * Sets _cdata property fieldName to val.
         */
        _st : function( /* String */ fieldName, /* any */ val )
        {
            this._cdata[ fieldName ] = val;
        }
    });
});