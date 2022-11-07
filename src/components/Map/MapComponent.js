import * as React from 'react';
import * as ol from 'ol';
import MapContext from './MapContext';
import './Map.css';
import { Overlay } from 'ol';
import Draw from 'ol/interaction/Draw';
import { Vector as VectorSource } from 'ol/source';
import VectorLayer from 'ol/layer/Vector';
import { ScaleLine, MousePosition, defaults as defaultControls } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import { getArea, getLength } from 'ol/sphere';
import { Circle, LineString, Polygon } from 'ol/geom';
import { fromCircle } from 'ol/geom/Polygon';
import { unByKey } from 'ol/Observable';
import GeoJSON from 'ol/format/GeoJSON';
import { get } from 'ol/proj';

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

        let control;
        
        let options = {
            view: new ol.View({ zoom, center }),
            layers: [],
            controls: defaultControls().extend([scaleControl()]),
            overlays: []
        };

        let mapObject = new ol.Map(options);
        mapObject.setTarget(mapRef.current);   

        /** Блок оверлея с всплывающей информацией по фичам */
        const overlay = new Overlay({
            element: document.querySelector('.ol-overlaycontainer'),
            positioning: 'top-center',
        })     
        mapObject.addOverlay(overlay);

        mapObject.on('click', (e) => {
            overlay.setPosition(undefined);
                /** Условие, чтобы всплывающие окна вылезали только если режим рисования выключен */
                if (drawTypeSelect.value === 'None') {
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

        /** Начало блока с рисованием фич */
        const drawSource = new VectorSource({ wrapX: false });
        const vectorLayer = new VectorLayer({
            source: drawSource,
            zIndex: 1,
        })
        mapObject.addLayer(vectorLayer);

        let draw;
        let sketch;
        function addInteraction() {
            const value = drawTypeSelect.value;
            if (value !== 'None') {
                draw = new Draw({
                    source: drawSource,
                    type: drawTypeSelect.value,
                })
                mapObject.addInteraction(draw);
                /** Для точек не нужен тултип, у них нет длины или плошади, нет информации, а div будут
                 *  плодиться.
                 */
                if (value !== 'Point') {
                    createMeasureTooltip();
                }

                let listener;
                draw.on('drawstart', (e) => {
                    /** Для точек это лишняя логика */
                    if (value !== 'Point') {
                        sketch = e.feature;
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
                        document.getElementById('undo').onclick = function () {
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
                    /** Для точек не инициировался tooltip, поэтому и не удаляется */
                    if (value !== 'Point') {
                        /** Тестовая строка, перегонял данные отрисованной фичи в
                         * GeoJSON, а потом тестировал их отрисовку, по выведенным
                         * данным
                         */
                        console.log(new GeoJSON().writeFeature(sketch, {
                            dataProjection: "EPSG:4326", 
                            featureProjection: "EPSG:3857"
                        }));
                        /** Конец теста */
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
            }
        }

        /** Переключатель типа рисовки */
        drawTypeSelect.onchange = function() {
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
        let measureTooltip;
        let measureTooltipElement;

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