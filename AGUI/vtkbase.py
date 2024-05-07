# -*- coding: utf-8 -*-

import vtk

class ModelViewer:
    def __init__(self):
        self.renderer = None
        self.renderWindow = None
        self.renderWindowInteractor = None
        self.current_actor = None
        self.bounding_box_actor = None  # Actor for the bounding box
        self.dimension_actors = []  # To hold the dimension text actors
        self.initialize_vtk_components()

    def initialize_vtk_components(self):
        self.renderer = vtk.vtkRenderer()
        self.renderer.SetBackground(0.1, 0.2, 0.4)  # Dark blue background

        self.renderWindow = vtk.vtkRenderWindow()
        self.renderWindow.SetSize(800, 600)
        self.renderWindow.SetWindowName("ArtGUI - Model Viewer")
        self.renderWindow.AddRenderer(self.renderer)

        self.renderWindowInteractor = vtk.vtkRenderWindowInteractor()
        self.renderWindowInteractor.SetRenderWindow(self.renderWindow)
        # self.renderWindowInteractor.SetDesiredUpdateRate(0.1)

        style = vtk.vtkInteractorStyleTrackballCamera()
        self.renderWindowInteractor.SetInteractorStyle(style)
        self.create_axes()

        # Monitor window close events
        self.renderWindowInteractor.AddObserver("ExitEvent", self.on_window_close)

    def create_axes(self):
        axes = vtk.vtkAxesActor()
        axes.SetPosition(0, 0, 0) # never worked
        self.axes_widget = vtk.vtkOrientationMarkerWidget()
        self.axes_widget.SetOutlineColor(0.9300, 0.5700, 0.1300)
        self.axes_widget.SetOrientationMarker(axes)
        self.axes_widget.SetInteractor(self.renderWindowInteractor)
        self.axes_widget.SetViewport(0.0, 0.0, 0.3, 0.3)
        self.axes_widget.SetEnabled(1)
        self.axes_widget.InteractiveOn()
       

    def load_and_display_stl(self, file_path):
        if self.renderWindowInteractor.GetRenderWindow().GetNeverRendered():
            self.initialize_vtk_components()
        
        reader = vtk.vtkSTLReader()
        reader.SetFileName(file_path)
        reader.Update()  

        # Calculate bounds and dimensions
        bounds = reader.GetOutput().GetBounds()
        x_dim = bounds[1] - bounds[0]
        y_dim = bounds[3] - bounds[2]
        z_dim = bounds[5] - bounds[4]

        # Display bounding box and model
        # self.display_bounding_box(reader)
        self.display_model(reader)
        self.display_dimensions(x_dim, y_dim, z_dim, bounds)

        self.renderer.ResetCamera()

    def display_bounding_box(self, reader):
        outline_filter = vtk.vtkOutlineFilter()
        outline_filter.SetInputConnection(reader.GetOutputPort())

        outline_mapper = vtk.vtkPolyDataMapper()
        outline_mapper.SetInputConnection(outline_filter.GetOutputPort())

        outline_actor = vtk.vtkActor()
        outline_actor.SetMapper(outline_mapper)
        outline_actor.GetProperty().SetColor(1, 0, 0)  

        if self.bounding_box_actor:
            self.renderer.RemoveActor(self.bounding_box_actor)
        self.renderer.AddActor(outline_actor)
        self.bounding_box_actor = outline_actor

    def display_model(self, reader):
        mapper = vtk.vtkPolyDataMapper()
        mapper.SetInputConnection(reader.GetOutputPort())

        actor = vtk.vtkActor()
        actor.SetMapper(mapper)

        if self.current_actor:
            self.renderer.RemoveActor(self.current_actor)
        self.renderer.AddActor(actor)
        self.current_actor = actor

    

    def display_dimensions(self, x_dim, y_dim, z_dim, bounds):
        # Clear previous dimension actors
        for actor in self.dimension_actors:
            self.renderer.RemoveActor(actor)
        self.dimension_actors.clear()

        self.add_dimension_text(f"Bounding Length X: {x_dim:.2f}", 0, 0, 0)
        self.add_dimension_text(f"Bounding Length Y: {y_dim:.2f}", 0, 12, 0)
        self.add_dimension_text(f"Bounding Length Z: {z_dim:.2f}", 0, 24, 0)

        self.add_dimension_text(f"Lower Pt x: {bounds[0]:.2f}", 200, 0, 0)
        self.add_dimension_text(f"Lower Pt y: {bounds[2]:.2f}", 200, 12, 0)
        self.add_dimension_text(f"Lower Pt z: {bounds[4]:.2f}", 200, 24, 0)

        self.add_dimension_text(f"Upper Pt x: {bounds[1]:.2f}", 350, 0, 0)
        self.add_dimension_text(f"Upper Pt y: {bounds[3]:.2f}", 350, 12, 0)
        self.add_dimension_text(f"Upper Pt z: {bounds[5]:.2f}", 350, 24, 0)

    def add_dimension_text(self, text, x, y, z):
        text_actor = vtk.vtkTextActor()
        text_actor.SetInput(text)
        text_actor.GetTextProperty().SetColor(1,1,1) 
        text_actor.GetTextProperty().SetFontSize(12)
        text_actor.SetPosition(x, y)
        self.renderer.AddActor(text_actor)
        self.dimension_actors.append(text_actor)

    def start(self):
        self.renderWindow.Render()
        self.renderWindowInteractor.Start()

    def update_model(self, file_path):
        
        if self.current_actor is None:
            self.initialize_vtk_components()

        self.load_and_display_stl(file_path)
        self.renderWindow.Render()

    def on_window_close(self, obj, event):
        self.current_actor = None
        self.bounding_box_actor = None



