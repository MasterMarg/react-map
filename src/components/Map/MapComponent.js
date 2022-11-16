import * as React from 'react';
import * as ol from 'ol';
import MapContext from './MapContext';
import './Map.css';
import { Overlay } from 'ol';
import { Draw, Select, Modify } from 'ol/interaction';
import { Vector as VectorSource } from 'ol/source';
import VectorLayer from 'ol/layer/Vector';
import { ScaleLine, MousePosition, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import { getArea, getLength } from 'ol/sphere';
import { Circle, LineString, Point, Polygon } from 'ol/geom';
import { fromCircle } from 'ol/geom/Polygon';
import { unByKey } from 'ol/Observable';
import WKT from 'ol/format/WKT';

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

        let control;
        
        let options = {
            view: new ol.View({ zoom, center }),
            layers: [],
            controls: defaultControls().extend([scaleControl()]),
            overlays: []
        };

        let mapObject = new ol.Map(options);
        mapObject.setTarget(mapRef.current);        
        
        let isModifyModeOn = false;
        /** Блок оверлея с всплывающей информацией по фичам */
        const overlay = new Overlay({
            element: document.querySelector('.ol-overlaycontainer'),
            positioning: 'top-center',
        })     
        mapObject.addOverlay(overlay);

        mapObject.on('click', (e) => {
            overlay.setPosition(undefined);
                /** Условие, чтобы всплывающие окна вылезали только если режим рисования выключен */
                if (!isModifyModeOn && drawTypeSelect.value === 'None') {
                mapObject.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
                    document.querySelector('.ol-overlaycontainer').innerHTML = feature.get('description');                
                    overlay.setPosition(e.coordinate);
                })
            }
        });
        /** Конец блока оверлея с всплывающей информацией по фичам */

        /** Блок координат курсора */
        let mousePosition = new MousePosition({
            coordinateFormat: createStringXY(7),
            projection: "EPSG:4326",
        });
        mapObject.getViewport().addEventListener('mouseenter', (e) => {
            mapObject.addControl(mousePosition);
        })

        mapObject.getViewport().addEventListener('mouseleave', (e) => {
            mapObject.removeControl(mousePosition);
        })
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

        unitsSelect.addEventListener('change', onChangeUnit);
        scaleTypeSelect.addEventListener('change', reconfigureScaleLine);
        stepsRange.addEventListener('input', reconfigureScaleLine);
        scaleTextCheckbox.addEventListener('change', reconfigureScaleLine);
        invertColorsCheckbox.addEventListener('change', onInvertColorsChange);
        
        let select;
        let modify;
        let value = drawTypeSelect.value
        modifyButton.onclick = function() {
            if (value === 'None') {
                isModifyModeOn = !isModifyModeOn;
                modifyButton.classList.toggle('form-control-toggled')
                drawTypeSelect.disabled = isModifyModeOn;
                undoButton.disabled = isModifyModeOn;
                overlay.setPosition(undefined);
                addInteraction();
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
                /** Для точек не нужен тултип, у них нет длины или плошади, нет информации, а div будут
                 *  плодиться.
                 */

                draw.on('drawstart', (e) => {
                    sketch = e.feature;
                    /** Для точек это лишняя логика */
                    if (value !== 'Point') {
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
                    measureTooltip.setPosition(undefined);
                }
            } else {
                /** Начало блока с модифицированием фич */
                if (isModifyModeOn) {
                    let feature;
                    select = new Select({
                        wrapX: false,
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
                        feature = e.selected[0];                        
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
                        mapObject.removeInteraction(modify);
                        mapObject.removeInteraction(select);
                        isModifyModeOn = !isModifyModeOn;
                        modifyButton.classList.toggle('form-control-toggled')
                        drawTypeSelect.disabled = isModifyModeOn;
                        undoButton.disabled = isModifyModeOn;
                        if (value !== 'Point') {
                            feature = null;
                            measureTooltip.setPosition(undefined);
                        }
                    }) 
                /** Конец блока с модифицированием фич */
                } else {
                    mapObject.removeInteraction(modify);
                    mapObject.removeInteraction(select);
                }                        
            }
        }

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