.. _chapter-ArtGUI:

ArtGUI
******

ArtGUI is an intuitive graphical user interface designed to streamline the Artisan design workflow. Users can load their design file, i.e. JSON configuration, and perform editing, generation, and viewing of lattice structures all within a single application. ArtGUI emphasizes a user-friendly interface, catering to essential tasks while maintaining overall simplicity. For more complex mesh and geometric operations, users may need to utilize a professional CAD system. In future, we will gradually expand ArtGUI's functions and applications. We use a simple example below to guide user how to interact with this application. 

==================
Launch Application
==================

User may launch the application just type the following:

.. code-block::

    python ArtGUI.py

In the all-in-one standalone package, user may activate the ArtGUI by double click :code:`ArtGUI.exe`. 

=======================
Load, Save and Generate
=======================

The graphic below shows an overall view of the application. The interface includes four functional areas, setup, workflow, post process and the message panel. Each of section corresponds to JSON configuration of the file. User may able to enter the setup, workflow and post process sections, and save to a standard JSON configuration. Here we only load an existing example configuration for a quick demonstration. 

.. image:: ./pictures/ArtGUI/overall_view.png


On top, user shall find the file menu that includes :code:`Save`, :code:`Save as` and :code:`Load`. Click the load, then navigate to the :code:`Test_json` folder, where many examples were stored, find a configuration file and load it. Here we pick up :code:`Test_json\EngineBracket_HS_Infill_Lin_LR.txt`, as shown below. The ArtGUI will parse the given JSON file, fill the setup, post-process sections, and load the workflow text into the workflow section.

.. image:: ./pictures/ArtGUI/Loadfiles.png

.. image:: ./pictures/ArtGUI/Loadfiles_01.png

The workflow panel shows the highlighted JSOn keywords and structures. Please note that, the JSON format is enforced in the text panel, after key in the items, and press enter it will automatically apply highlight and indentation in order to improve readability. If any editing has done, user has to save it (i.e. the shortcut Ctrl + S) may click the generate button under the workflow panel. ArtGUI shall trigger the Artisan backend to work. In this case we just would like to give the example file a run, so hit the generate button. Then you shall see the computational progress message on the message panel. 

.. image:: ./pictures/ArtGUI/Loadfiles_02.png


==========
View Model
==========

Click the view model button, user should see the view port screen here. User may rotate, pan or zoom in/out to check the results. 

.. image:: ./pictures/ArtGUI/Loadfiles_03.png

User may change the design parameters in the JSON workflow, and re-generate a new lattice result, just click the update view, the new result should be updated in the view port. At the bottom of the view port, user shall be able to see the bounding lengths, and the lower point and upper point of the bounding box. Please note that, if the JSON workflow last line does not contain the keywords :code:`Export` and did not give a result file, the view port will not be updated. 

.. note::
    The edited JSON must be saved before generating. Artisan at the backend only read the JSON and conduct the calculation, and will not have interaction with ArtGUI.   

====
Help
====

The help menu just provide an easy access to the Artisan's online manual, as shown below. 

.. image:: ./pictures/ArtGUI/helpshow.png