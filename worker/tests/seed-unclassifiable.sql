-- A row the seed loader would refuse, planted directly so the API test proves the Worker never answers it.
INSERT OR REPLACE INTO items (upc,name,size_ml,drink,material,refillable,class,source)
VALUES ('0000000000055','SYNTHETIC wine, container unknown',750,'wine','unknown',0,'liquor','synthetic');
