import * as React from 'react';
import * as ol from 'ol';
import MapContext from './MapContext';
import './Map.css';
import { Overlay } from 'ol';
import { Draw, Select, Modify } from 'ol/interaction';
import { ImageWMS, TileWMS, Vector, Vector as VectorSource } from 'ol/source';
import VectorLayer from 'ol/layer/Vector';
import { ScaleLine, MousePosition, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import { getArea, getLength } from 'ol/sphere';
import { Circle, LineString, Point, Polygon } from 'ol/geom';
import { fromCircle } from 'ol/geom/Polygon';
import { unByKey } from 'ol/Observable';
import WKT from 'ol/format/WKT';
import gasIcon from '../../resources/Газ.png';
import { blue } from '@mui/material/colors';
import Collection from 'ol/Collection';
import { Style, Icon, Stroke, Fill, Text } from 'ol/style';
import Feature from 'ol/Feature';
import { get } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import TileLayer from 'ol/layer/Tile';
import GeoJSON from 'ol/format/GeoJSON';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';

const MapComponent = ({ children, zoom, center }) => {
    const mapRef = React.useRef();
    const [map, setMap] = React.useState(null);
    

    React.useEffect(() => {
        const drawTypeSelect = document.getElementById('drawType');
        const scaleBarOptionsContainer = document.getElementById('scaleBarOptions');
        const scaleTypeSelect = document.getElementById('scaleType');
        const unitsSelect = document.getElementById('units');
        const stepsRange = document.getElementById('steps');
        const scaleTextCheckbox = document.getElementById('showScaleText');
        const invertColorsCheckbox = document.getElementById('invertColors');
        const modifyButton = document.getElementById('modify');
        const undoButton = document.getElementById('undo');
        const removeButton = document.getElementById('remove');
        const measureButton = document.getElementById('measure');
        const mouseProjection = document.getElementById('mousePositionProjection');

        let control;
        let mapView = new ol.View({ zoom, center });
        
        let options = {
            view: mapView,
            layers: [],
            controls: defaultControls().extend([scaleControl()]),
            overlays: []
        };

        let mapObject = new ol.Map(options);
        mapObject.setTarget(mapRef.current);  
        
        /** Начало блока слоя фич из БД */
        function getFeatureStyle(feature) {  
            let geometry = feature.getGeometry();
            if (geometry instanceof Circle) {
              return new Style({
                stroke: new Stroke({
                  color: "rgba(0, 122, 122)",
                  width: 3,
                }),
                fill: new Fill({
                  color: "rgba(228, 28, 128, 0.2)",
                }),        
                text: new Text({
                  font: "bold italic 15px serif",
                  fill: new Fill({
                    color: "rgba(0, 122, 122)",
                  }),
                  text: feature.get("name"),
                })
              })
            } 
            if (geometry instanceof Polygon) {
              return new Style({
                stroke: new Stroke({
                  color: "rgba(122, 3, 3)",
                  width: 3,
                }),
                fill: new Fill({
                  color: "rgba(36, 171, 212, 0.3)",
                }),        
                text: new Text({
                  font: "bold italic 15px serif",
                  fill: new Fill({
                    color: "rgba(122, 3, 3)",
                  }),
                  text: feature.get("name"),
                })
              })
            } 
            if (geometry instanceof LineString) {
              return new Style({
                stroke: new Stroke({
                  color: "rgba(121, 0, 143)",
                  width: 3,
                }),     
                text: new Text({
                  font: "bold italic 15px serif",
                  offsetY: -11,
                  placement: "line",
                  fill: new Fill({
                    color: "rgba(121, 0, 143)",
                  }),
                  text: feature.get("name"),
                })
              })
            }
            if (geometry instanceof Point) {
              return new Style({
                image: new Icon({
                  src: gasIcon,
                  scale: 0.07,
                }),
                text: new Text({
                  font: "bold italic 15px serif",            
                  offsetX: 75,
                  fill: new Fill({
                    color: blue[900],
                  }),
                  text: feature.get("name"),
                })
              })
            }
        }

        function loadFeatures() {
            let features = new Collection();  
            /** Начало части с PostGIS */
            fetch("http://localhost:8080/feature/getAll")
              .then(res => res.json())
              .then((result) => result.map(object => {
                let feature = new Feature({
                  geometry: new WKT().readGeometry(object[3]),
                  featureProjection: get("EPSG:3857"),
                  id: object[0],
                  name: object[1],
                  description: object[2],
                })
                feature.setStyle(getFeatureStyle(feature))
                features.push(feature)
              })) 
            fetch("http://localhost:8080/circle/getAll")
              .then(res => res.json())
              .then((result) => result.map(circle => {
                let feature = new Feature({
                  geometry: new Circle(circle.center, circle.radius),
                  featureProjection: get("EPSG:3857"),
                  id: circle.id,
                  name: circle.name,
                  description: circle.description,
                })
                feature.setStyle(getFeatureStyle(feature))
                features.push(feature);
              }))
            /** Конец части с PostGIS */
            /** Начало части без PostGIS */
            /*
            fetch("http://localhost:8080/polygon/getAll")
              .then(res => res.json())
              .then((result) => result.map(geometry => {
                let feature = new Feature({
                  geometry: new GeoJSON().readGeometry(geometry),
                  featureProjection: get("EPSG:3857"),
                  description: "Area: " + geometry.size,      
                })
                feature.setStyle(new Style({
                  stroke: new Stroke({
                    color: "rgba(122, 3, 3)",
                    width: 3,
                  }),
                  fill: new Fill({
                    color: "rgba(36, 171, 212, 0.3)",
                  }),        
                  text: new Text({
                    font: "bold italic 15px serif",
                    fill: new Fill({
                      color: "rgba(122, 3, 3)",
                    }),
                    text: geometry.name,
                  })
                }))
                features.push(feature);
              }))
            fetch("http://localhost:8080/circle/getAll")
              .then(res => res.json())
              .then((result) => result.map(geometry => {
                let feature = new Feature({
                  geometry: new Circle(geometry.center, geometry.radius),
                  featureProjection: get("EPSG:3857"),
                  description: "Area: " + geometry.size,
                })
                feature.setStyle(new Style({
                  stroke: new Stroke({
                    color: "rgba(0, 122, 122)",
                    width: 3,
                  }),
                  fill: new Fill({
                    color: "rgba(228, 28, 128, 0.2)",
                  }),        
                  text: new Text({
                    font: "bold italic 15px serif",
                    fill: new Fill({
                      color: "rgba(0, 122, 122)",
                    }),
                    text: geometry.name,
                  })
                }))
                features.push(feature);
              }))
            fetch("http://localhost:8080/line/getAll")
              .then(res => res.json())
              .then((result) => result.map(geometry => {
                let feature = new Feature({
                  geometry: new GeoJSON().readGeometry(geometry),
                  featureProjection: get("EPSG:3857"),
                  description: "Length: " + geometry.size,
                });
                feature.setStyle(new Style({
                  stroke: new Stroke({
                    color: "rgba(121, 0, 143)",
                    width: 3,
                  }),     
                  text: new Text({
                    font: "bold italic 15px serif",
                    offsetY: -11,
                    placement: "line",
                    fill: new Fill({
                      color: "rgba(121, 0, 143)",
                    }),
                    text: geometry.name,
                  })
                }))
                features.push(feature);
              }))
            fetch("http://localhost:8080/point/getAll")
              .then(res => res.json())
              .then((result) => result.map(geometry => {
                let feature = new Feature({
                  geometry: new GeoJSON().readGeometry(geometry),
                  featureProjection: get("EPSG:3857"),
                  description: geometry.description,
                });
                feature.setStyle(new Style({
                  image: new Icon({
                    src: gasIcon,
                    scale: 0.07,
                  }),
                  text: new Text({
                    font: "bold italic 15px serif",            
                    offsetX: 75,
                    fill: new Fill({
                      color: blue[900],
                    }),
                    text: geometry.name,
                  })
                }));
                features.push(feature);
              }))
              */
            /** Конец части без PostGIS */
            return features;
        }

        let dbLayer = new VectorLayer({
            zIndex: 2,
            source: new Vector({
                features: loadFeatures(),
            })
        })
        mapObject.addLayer(dbLayer);
        /** Конец блока слоя фич из БД */

        /** Тест с геосервером */
        let wmsLayer =  new ImageLayer({
            zIndex: 3,
            source: new ImageWMS({
              url: 'http://192.168.3.15:5557/geoserver/wms',
              params: {'LAYERS': 'kust_v060922:outputs'},
            }),
        })
        mapObject.addLayer(wmsLayer);
        const wmsSource = new TileWMS({
            url: 'http://192.168.3.15:5557/geoserver/wms',
            params: {'layers': 'kust_v060922:pipes', 'tiled':'true'},
        })
        const wmsLayer2 = new TileLayer({
            zIndex:2,
            source: wmsSource,
        })
        mapObject.addLayer(wmsLayer2)
        /** Слой с подложкой */
        /*
        let wmsLayer3 = new TileLayer({
            zIndex: 1,
            source: new TileWMS({
                url: 'http://192.168.3.15:5557/geoserver/wms',
                params: {'layers':'	kust_redo:surface_201022_v2', 'tiled':'true'}
            })
        })
        mapObject.addLayer(wmsLayer3) 
        */      
        /** Конец слоя с подложкой */
        /** Конец теста с геосервером */
        
        let isModifyModeOn = false;
        let isMeasureModeOn = false;
        /** Блок оверлея с всплывающей информацией по фичам */
        const overlay = new Overlay({
            element: document.querySelector('.ol-overlaycontainer'),
            positioning: 'top-center',
        })     
        mapObject.addOverlay(overlay);

        mapObject.on('click', (e) => {
            overlay.setPosition(undefined);
                /** Условие, чтобы всплывающие окна вылезали только если режимы рисования и измерения выключены */
            if (!isMeasureModeOn && !isModifyModeOn && drawTypeSelect.value === 'None') {
                mapObject.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
                    document.querySelector('.ol-overlaycontainer').innerHTML = feature.get('description');                
                    overlay.setPosition(e.coordinate);
                })
                if (!overlay.getPosition()) {
                    const url = wmsSource.getFeatureInfoUrl(
                        e.coordinate,
                        mapView.getResolution(),
                        'EPSG:3857',
                        {
                            'info_format': 'application/json',
                            'query_layers': wmsSource.getParams().layers,
                        }
                    )
                    if (url) {
                        fetch(url)
                            .then(res => res.json())
                            .then((result) => {
                                if (result.features.length > 0) {                                    
                                    /* можно напрямую по свойствам, но не очень красиво
                                    console.log(result.features[0].properties.Наиме)
                                    */
                                    let loadedFeature = new GeoJSON().readFeature(result.features[0])
                                    document.querySelector('.ol-overlaycontainer').innerHTML = 
                                        loadedFeature.get("Наиме") + "\nКуст: " + loadedFeature.get("Куст");                                
                                    overlay.setPosition(e.coordinate);
                                } 
                            })
                    }
                }
            }
        });
        /** Конец блока оверлея с всплывающей информацией по фичам */

        /** Блок координат курсора */                    
        proj4.defs(
            'EPSG:40004',
            'PROJCS["MSK-89 zone 4 (6 grad) YNAO", GEOGCS["Krassovsky, 1942", DATUM["Pulkovo 1942", SPHEROID["krass", 6378245.0, 298.3], TOWGS84[23.57, -140.95, -79.8, 0.0, 0.35, 0.79, -0.22]], PRIMEM["Greenwich", 0.0], UNIT["degree", 0.017453292519943295], AXIS["Longitude", EAST], AXIS["Latitude", NORTH]], PROJECTION["Transverse_Mercator"], PARAMETER["central_meridian", 78.05], PARAMETER["latitude_of_origin", 0.0], PARAMETER["scale_factor", 1.0], PARAMETER["false_easting", 4500000.0], PARAMETER["false_northing", -5811057.63], UNIT["m", 1.0], AXIS["x", EAST], AXIS["y", NORTH], AUTHORITY["EPSG","40004"]]',
        );
        register(proj4);

        let mousePosition = new MousePosition({
            coordinateFormat: createStringXY(7),
            projection: mouseProjection.value,
        });

        mapObject.getViewport().addEventListener('mouseenter', (e) => {
            mapObject.addControl(mousePosition);
        })

        mapObject.getViewport().addEventListener('mouseleave', (e) => {
            mapObject.removeControl(mousePosition);
        })

        function onProjectionChanged() {
            mousePosition.setProjection(mouseProjection.value);
        }
        /** Конец блока координат курсора */

        /** Блок линейки в углу карты */
        function scaleControl() {
            if (scaleTypeSelect.value === 'scaleline') {
                control = new ScaleLine({
                    units: unitsSelect.value,
                });
                scaleBarOptionsContainer.style.display = 'none';
            } else {
                control = new ScaleLine({
                    units: unitsSelect.value,
                    bar: true,
                    steps: parseInt(stepsRange.value, 10),
                    text: scaleTextCheckbox.checked,
                    minWidth: 140,
                });
                onInvertColorsChange();
                scaleBarOptionsContainer.style.display = 'block';
            }
            return control;
        }

        function onInvertColorsChange() {
            control.element.classList.toggle(
                'ol-scale-bar-inverted',
                invertColorsCheckbox.checked
            );
        }

        function reconfigureScaleLine() {
            mapObject.removeControl(control);
            mapObject.addControl(scaleControl());
        }

        function onChangeUnit() {
            control.setUnits(unitsSelect.value);
        }
        /** Конец блока линейки в углу карты */

        mouseProjection.addEventListener('change', onProjectionChanged)
        unitsSelect.addEventListener('change', onChangeUnit);
        scaleTypeSelect.addEventListener('change', reconfigureScaleLine);
        stepsRange.addEventListener('input', reconfigureScaleLine);
        scaleTextCheckbox.addEventListener('change', reconfigureScaleLine);
        invertColorsCheckbox.addEventListener('change', onInvertColorsChange);
        
        let select;
        let modify;
        let value = drawTypeSelect.value

        /** Кнопка переключения режима редактирования */
        modifyButton.onclick = function() {
            if (value === 'None') {
                toggleButtons();
                overlay.setPosition(undefined);
                addInteraction();
            }
        }

        /** Кнопка переключения режима измерения */  
        let source = new VectorSource({wrapX: false})
        let layer = new VectorLayer({
            source: source,
            zIndex: 4,
        })
        mapObject.addLayer(layer); 

        let measureDraw = new Draw({
            source: source,
            type: 'LineString',
            maxPoints: 2,
        })

        let drawnFeature;     
        measureDraw.on('drawstart', (e) => {            
            source.clear();
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
            drawnFeature = e.feature;
            drawnFeature.getGeometry().on('change', (event) => {
                measureTooltipElement.innerHTML = 'Distance: ' + formatLength(drawnFeature.getGeometry())
                measureTooltip.setPosition(drawnFeature.getGeometry().getLastCoordinate())
            })
        })
        measureDraw.on('drawend', () => {
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
            drawnFeature.setStyle(new Style({
                stroke: new Stroke({
                    color: 'dodgerblue',
                    width: 3,
                })
            }))
        })

        measureButton.onclick = function() {
            if (value === 'None') {
                isMeasureModeOn = !isMeasureModeOn;
                measureButton.classList.toggle('form-control-toggled')
                modifyButton.disabled = isMeasureModeOn;
                drawTypeSelect.disabled = isMeasureModeOn;
                if (isMeasureModeOn) {                       
                    mapObject.addInteraction(measureDraw);
                } else {
                    source.clear();
                    measureTooltip.setPosition(undefined);
                    mapObject.removeInteraction(measureDraw);
                }
            }
        }

        /** Начало блока с рисованием фич */
        const drawSource = new VectorSource({ wrapX: false });
        const vectorLayer = new VectorLayer({
            source: drawSource,
            zIndex: 1,
        })
        mapObject.addLayer(vectorLayer);

        let draw;
        let sketch;
        let listener;
        let measureTooltip;
        let measureTooltipElement;
        function addInteraction() {
            value = drawTypeSelect.value;
            if (value !== 'Point') {
                createMeasureTooltip();
            }
            if (value !== 'None') {
                draw = new Draw({
                    source: drawSource,
                    type: drawTypeSelect.value,
                })
                mapObject.addInteraction(draw);
                /** Для точек не нужен тултип, у них нет длины или плошади,
                 *  нет информации, а div будут плодиться.
                 */

                draw.on('drawstart', (e) => {
                    sketch = e.feature;
                    /** Для точек это лишняя логика */
                    if (value !== 'Point') {                        
                        undoButton.disabled = false;
                        let geom;
                        let tooltipCoord = e.coordinate;
                        listener = sketch.getGeometry().on('change', (evt) => {
                            geom = evt.target;
                            let output;
                            if (geom instanceof Polygon) {
                                output = formatArea(geom);
                                tooltipCoord = geom.getInteriorPoint().getCoordinates();
                            } else if (geom instanceof LineString) {
                                output = formatLength(geom);
                                tooltipCoord = geom.getLastCoordinate();
                            } else if (geom instanceof Circle) {
                                output = formatArea(fromCircle(geom));
                                tooltipCoord = geom.getCenter();
                            }
                            measureTooltipElement.innerHTML = output;
                            measureTooltip.setPosition(tooltipCoord);
                        })

                        /** Кнопка Undo */                    
                        undoButton.onclick = function () {
                            if (sketch != null) {
                                draw.removeLastPoint();
                                if (geom instanceof Circle 
                                    || (geom instanceof LineString 
                                        && sketch.getGeometry().getCoordinates().length <= 1)
                                    || (geom instanceof Polygon 
                                        && sketch.getGeometry().getCoordinates()[0].length <=2)) {
                                            abortDrawing();
                                }                        
                            }
                        };
                    };
                });

                draw.on('drawend', () => { 
                    /** Circle не поддерживается GeoJSON и WKT, есть 2 выхода:
                         * 1. Переделывать геометрию в полигон с большим количеством точек,
                         * но выглядит это все равно не очень красиво
                         * 2. Передавать данные как ключ-значение, отдельно собирая передаваемый
                         * объект, напрямую ставя центр и радиус, а потом программно создавать
                         * фичу Circle на основе полученных данных
                         */
                        /** 1 
                         * console.log(new GeoJSON().writeGeometry(fromCircle(sketch.getGeometry(), 100), {
                         *     dataProjection: "EPSG:4326", 
                         *     featureProjection: "EPSG:3857"
                         * }))
                         */
                        /** 2 
                         * let feature = new Feature({
                         *   geometry: new Circle([1,1], 1),
                         * });
                         * console.log(feature.getGeometry().getCenter());
                         * console.log(feature.getGeometry().getRadius());
                         */  
                  
                    /** Начало части для PostGIS */
                    if (sketch.getGeometry() instanceof Circle) {
                        fetch("http://localhost:8080/circle/add", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                "name": "Круг, возможно,\nМихаил",
                                "description": "Area: " + formatArea(fromCircle(sketch.getGeometry())),
                                "center": sketch.getGeometry().getCenter(),
                                "radius": sketch.getGeometry().getRadius(),
                            })
                        })
                    } else {
                        fetch("http://localhost:8080/feature/add", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                "name": sketch.getGeometry() instanceof Polygon 
                                    ? "Любая фигура, но\nМалевича" :
                                    sketch.getGeometry() instanceof LineString
                                    ? "Трубопровод с мечтами" : "Месторождение",
                                "description": sketch.getGeometry() instanceof Polygon 
                                    ? "Area: " + formatArea(sketch.getGeometry()) :
                                    sketch.getGeometry() instanceof LineString
                                    ? "Length: " + formatLength(sketch.getGeometry()) :
                                    "Здесь лежит газ и отдыхает",
                                "geometry": new WKT().writeGeometry(sketch.getGeometry()),
                            })
                        })  
                    }
                    undoButton.disabled = true;
                    /** Конец части для PostGIS */
                    /** Начало части без PostGIS */   
                    /*           
                    if (sketch.getGeometry() instanceof Circle) {
                        fetch("http://localhost:8080/circle/add", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                "center": sketch.getGeometry().getCenter(),
                                "radius": sketch.getGeometry().getRadius(),
                                "size": formatArea(fromCircle(sketch.getGeometry())),
                                "name": "Круг, возможно,\nМихаил",
                            })
                        })                   
                    } else if (sketch.getGeometry() instanceof Point) {
                        fetch("http://localhost:8080/point/add", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                "type": "Point",
                                "coordinates": sketch.getGeometry().getCoordinates(),
                                "description": "Тут лежит газ и отдыхает",
                                "name": "Месторождение",
                            }),
                        })
                    } else if (sketch.getGeometry() instanceof LineString) {
                        fetch("http://localhost:8080/line/add", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                "type": "LineString",
                                "coordinates": sketch.getGeometry().getCoordinates(),
                                "size": formatLength(sketch.getGeometry()),
                                "name": "Линия чего-то там",
                            }),
                        })
                    } else {
                        fetch("http://localhost:8080/polygon/add", {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({
                                "type": "Polygon",
                                "coordinates": sketch.getGeometry().getCoordinates(),
                                "size": formatArea(sketch.getGeometry()),
                                "name": "Любая фигура,\nно Малевича",
                            })
                        })
                    }
                    */
                    /** Конец части без PostGIS */

                    /** Для точек не инициировался tooltip, поэтому и не удаляется */
                    if (value !== 'Point') {
                        sketch = null;
                        measureTooltipElement.className = 'ol-tooltip ol-tooltip-static';
                        measureTooltipElement = null;
                        createMeasureTooltip();
                        unByKey(listener);
                    }
                })

                function abortDrawing() {
                    draw.abortDrawing();
                    undoButton.disabled = true;
                    measureTooltip.setPosition(undefined);
                }
            } else {
                /** Начало блока с модифицированием фич */
                if (isModifyModeOn) {
                    let feature;
                    select = new Select({
                        wrapX: false,
                        layers: [dbLayer],
                        filter: function(featureToSelect, layer) {
                            if (feature) {
                                /** Ищем ближайшую точку из геометрии и сравниваем координаты
                                 * 
                                 * Также смотрим на поле id, у фич, полученных из БД оно есть
                                 * (для апдейта геометрии), а у узловых точек других фич - его нет.
                                 * Так мы оставляем возможность выбирать и модифицировать 
                                 * фичи, с пересекающимися координатами.
                                 * 
                                 * Так же проверяем только точки, поскольку у круга 
                                 * circle.getGeometry().getCoordinates() возвращает null,
                                 * геометрия круга определяется иначе (центр + радиус), поэтому
                                 * если нужно фильтровать круги, то нужно делать отдельную ветку
                                 * if (featureToSelect.getGeometry() instanceof Circle), но в нашем
                                 * случае проблема была только с точками, поэтому я исключил из проверки
                                 * все другие типы геометрий
                                 */
                                if (featureToSelect.getGeometry() instanceof Point && !featureToSelect.get("id")) {
                                    let featureToSelectCoords = featureToSelect.getGeometry().getCoordinates();
                                    let closestPointCoords = feature.getGeometry().getClosestPoint(featureToSelectCoords);
                                    if (featureToSelectCoords[0] === closestPointCoords[0] 
                                            && featureToSelectCoords[1] === closestPointCoords[1]) {
                                        return false;
                                    }
                                }
                            }
                            return true;
                        }
                    })
                    mapObject.addInteraction(select);
                    modify = new Modify({
                        features: select.getFeatures(),
                    })                       
                    mapObject.addInteraction(modify);

                    select.on('select', (e) => {
                        /** todo: нужно сделать перебор фич на этой
                         * координате, а не просто выбирать первую фичу
                         * сверху
                         */
                        feature = e.selected[0];
                        removeButton.disabled = !feature;   
                    })
                    modify.on('modifystart', (e) => {
                        /** Для точек это лишняя логика */
                        if (value !== 'Point') {
                            let geom;
                            let tooltipCoord = e.coordinate;
                            listener = feature.getGeometry().on('change', (evt) => {
                                geom = evt.target;
                                let output;
                                if (geom instanceof Polygon) {
                                    output = formatArea(geom);
                                    tooltipCoord = geom.getInteriorPoint().getCoordinates();
                                } else if (geom instanceof LineString) {
                                    output = formatLength(geom);
                                    tooltipCoord = geom.getLastCoordinate();
                                } else if (geom instanceof Circle) {
                                    output = formatArea(fromCircle(geom));
                                    tooltipCoord = geom.getCenter();
                                }
                                measureTooltipElement.innerHTML = output;
                                measureTooltip.setPosition(tooltipCoord);
                            })
                        }
                    })
                    modify.on('modifyend', () => {                    
                        if (feature.getGeometry() instanceof Circle) {
                            feature.set("description", "Area: " 
                                + formatArea(fromCircle(feature.getGeometry())));
                            fetch("http://localhost:8080/circle/update", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    "id": feature.get("id"),
                                    "name": feature.get("name"),
                                    "description": feature.get("description"),
                                    "center": feature.getGeometry().getCenter(),
                                    "radius": feature.getGeometry().getRadius(),
                                })
                            })
                        } else {
                            feature.set("description", 
                                feature.getGeometry() instanceof Polygon
                                ? "Area: " + formatArea(feature.getGeometry())
                                : feature.getGeometry() instanceof LineString
                                ? "Length: " + formatLength(feature.getGeometry())
                                : "Здесь лежит газ и отдыхает");
                            fetch("http://localhost:8080/feature/update", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    "id": feature.get("id"),
                                    "name": feature.get("name"),
                                    "description": feature.get("description"),
                                    "geometry": new WKT().writeGeometry(feature.getGeometry()),
                                })
                            })
                        }
                        disableEditMode();
                        feature = null;
                        if (value !== 'Point') {
                            measureTooltip.setPosition(undefined);
                        }
                    }) 
                    
                    /** Кнопка удаления фич */
                    removeButton.onclick = function() {
                        /** Только что отрисованные фичи (до перезагрузки
                         * приложения) лежат в сорсе drawSource, в отдельном
                         * слое для рисования, их удалить нельзя (только
                         * в процессе рисования удалять кнопкой Undo,
                         * а сразу по завершении уже нельзя, только после
                         * перезагрузки приложения (обновления страницы),
                         * когда они подтянутся в загружаемый слой).
                         * Реализовать удаление сложно, потому что однозначно
                         * определить фичу можно только по id, а у новых
                         * отрисованных фич еще нет id, он создается при
                         * сохранении в БД и получается потом при обратной
                         * загрузке фичи из БД. То есть удалить по id можно
                         * только загруженные из БД фичи. Удалять без id
                         * не получится, потому что у нескольких фич может быть
                         * одинаковая геометрия */
                        /** Возможно можно проставлять id не в параметры
                         * фичи а прямо методом setId(), я не уверен, что у фич
                         * разной геометрии id и слоев не пересекаются, поэтому
                         * оставил так */
                        if (dbLayer.getSource().hasFeature(feature)) {
                            dbLayer.getSource().removeFeature(feature);
                            removeButton.disabled = true;
                            disableEditMode();
                            let restURL = feature.getGeometry() instanceof Circle 
                                ? "http://localhost:8080/circle/delete" 
                                : "http://localhost:8080/feature/delete";
                            fetch(restURL, {
                                method: "DELETE",
                                headers: {"Content-Type": "application/json" },
                                body: JSON.stringify({
                                    "id": feature.get("id"),
                                })
                            })
                        }
                    }
                    /** Конец блока кнопки удаления фич */

                    /** Выключает режим редактирования, переключает кнопки
                     * и т.д.
                     */
                    function disableEditMode() {
                        mapObject.removeInteraction(modify);
                        mapObject.removeInteraction(select);
                        toggleButtons();
                    }                    
                /** Конец блока с модифицированием фич */
                } else {
                    mapObject.removeInteraction(modify);
                    mapObject.removeInteraction(select);
                }                        
            }
        }
        /** Переключатель кнопок управления фичей */
        function toggleButtons() {
            //TO DO: включить режим редактирования, выбрать фичу, выключить
            // кнопка удаления остается активной, поправить, чтоб выключалась
            isModifyModeOn = !isModifyModeOn;
            modifyButton.classList.toggle('form-control-toggled')
            measureButton.disabled = isModifyModeOn;
            drawTypeSelect.disabled = isModifyModeOn;
            if (!isModifyModeOn) {
                removeButton.disabled = true;
            }
        }
        /** Конец переключателя кнопок управления фичей */

        /** Переключатель типа рисовки */
        drawTypeSelect.onchange = (event) => {
            mapObject.removeInteraction(draw);
            /** После отрисовки фичи вызывается метод createMeasureTooltip(), который заготавливает div
             *  под следующую фичу, которую пользователь будет рисовать. Это сделано для того,
             *  чтобы пользователь мог последовательно несколько линий рисовать, например, поэтому после
             *  первой фичи сразу готовится div для второй такой же фичи. Но при смене типа рисуемой
             *  фичи, создается еще один див, в итоге div плодятся, поэтому при переключении на другой тип
             *  рисовки я удаляю последний див, который был создан заранее и не пригодился, а потом уже,
             *  в зависимости от выбора при переключении создается div (или не создается, если выбраны
             *  Point или None).
             *  Условие такое написал, потому что на входе в приложение, при первом выборе при попадании
             *  в этот слушатель в верстке еще нет ни одного элемента, удовлетворяющего селектору. 
             *  Подходящий элемент появится только после вызова addInteraction() ниже, но мне не нужно
             *  удалять самый первый созданный элемент, поэтому условие стоит ДО вызова метода.
             */
            const overlayDiv = document.querySelector('.ol-overlay-container.ol-selectable:last-child');
            if (overlayDiv && overlayDiv.parentNode) {
                overlayDiv.parentNode.removeChild(overlayDiv);
            }
            modifyButton.disabled = event.target.value !== 'None'
            measureButton.disabled = event.target.value !== 'None'
            /** Конец вырезания последнего заготовленного div'а */
            addInteraction();
        }

        addInteraction();
        /** Конец блока с рисованием фич */
        /** Начало блока с вычислением значения для линейки на карте */
        const formatLength = function(line) {
            const length = getLength(line);
            let output;
            if (length > 100) {
                output = Math.round((length / 1000) * 100) / 100 + ' km';
            } else {
                output = Math.round(length * 100) / 100 + ' m';
            }
            return output;
        };

        const formatArea = function(polygon) {
            const area = getArea(polygon);
            let output;
            if (area > 10000) {
                output = Math.round((area / 1000000) * 100) / 100 + ' km<sup>2</sup>'
            } else {
                output = Math.round(area * 100) / 100 + ' m<sup>2</sup>';
            }
            return output;
        }
        /** Конец блока с вычислением значения для линейки на карте */
        /** Начало блока с линейкой на карте */

        function createMeasureTooltip() {
            if (measureTooltipElement) {
                measureTooltipElement.parentNode.removeChild(measureTooltipElement);
            }
            measureTooltipElement = document.createElement('div')
            measureTooltipElement.className = 'ol-tooltip ol-tooltip-measure';
            measureTooltip = new Overlay({
                element: measureTooltipElement,
                positioning: 'bottom-center',
                stopEvent: true,
                insertFirst: false,           
            })
            mapObject.addOverlay(measureTooltip);
        }
        /** Конец блока с линейкой на карте */

        setMap(mapObject);

        return () => mapObject.setTarget(undefined);
    }, []);

    React.useEffect(() => {
        if (!map) return;

        map.getView().setZoom(zoom);
    }, [zoom]);

    React.useEffect(() => {
        if (!map) return;

        map.getView().setCenter(center);
    }, [center]);

    return (
        <MapContext.Provider value = {{ map }}>
            <div ref = {mapRef} className = "ol-map">
                {children}
            </div>
        </MapContext.Provider>
    )
}

export default MapComponent;