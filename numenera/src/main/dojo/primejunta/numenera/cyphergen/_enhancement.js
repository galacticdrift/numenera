define([ "dojo/_base/declare",
         "dojo/_base/lang",
         "dojo/_base/array",
         "dojo/string",
         "./data/bricks" ],
function( declare,
          lang,
          array,
          string,
          bricks )
{
    return declare([], {
        _getEnhancement : function( cypher_type, item_type, action, level )
        {
            var template = "When @{action},"
            var special = this._fromObject( bricks.common_data.special_effects ).name;
            if( special != "#false" )
            {
                template += special;
            }
            template += " ${radius} ${verb} ${enhancement}.";
            var effect = this._fromObject( cypher_type.effect_types );
            this._cypher.enhancement = effect.name;
            this._cypher.item_type 
            this._cypher.radius = "the user";
            this._cypher.verb = effect.verb_s;
            this._cypher.duration = this._getModifiedProperty( cypher_type.durations, cypher_type.duration_probs, effect.duration_modifier );
            if( item_type.radius )
            {
                var radius = this._fromArray( item_type.radius ).name;
                if( radius != "#none" )
                {
                    this._cypher.cypher_class = "occultic";
                    this._cypher.radius = radius;
                    this._cypher.verb = effect.verb_p;
                }
            }
            try
            {
                this._cypher.description = string.substitute( template, this._cypher );
                this._cypher.description = string.substitute( this._cypher.description, this._cypher );
            }
            catch( e )
            {
                console.log( "Error populating template:", template, this._cypher, e );
            }
        }
    });
});