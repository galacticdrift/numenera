define([ "dojo/_base/declare",
         "dojo/_base/lang",
         "./_FeatureBase",
         "primejunta/numenera/chargen/data/origins/numenera/types",
         "primejunta/numenera/chargen/data/origins/strange/types" ],
       function( declare,
                 lang,
                 _FeatureBase,
                 numeneraDescriptors,
                 strangeDescriptors)
       {
           return declare([ _FeatureBase ], {
               FEATURE_TYPE : "TYPE",
               data : [{
                           origin : "numenera",
                           recursion : false,
                           payload_data : numeneraDescriptors
                       },
                       {
                           origin : "strange",
                           recursion : false,
                           payload_data : strangeDescriptors

                       }]
           });
       });